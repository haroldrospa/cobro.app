import React, { useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle,
    XCircle,
    Eye,
    Loader2,
    Calendar,
    Building2,
    DollarSign,
    Search,
    Filter,
    AlertCircle,
    Settings,
    History,
    Trash2,
    ShieldCheck,
    ShieldAlert,
    Mail,
    LogOut,
    User,
    Pencil,
    Clock,
    Plus,
    Users,
    Copy,
    Check,
    CreditCard,
    TrendingUp,
    RefreshCw,
    X,
    ExternalLink,
    Key,
    EyeOff,
    Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { getDaysRemaining } from "@/lib/utils";

// Precios oficiales actualizados para proyecciones MRR
const PLAN_PRICES: Record<string, number> = {
    'basic': 895,
    'pro': 1495,
    'enterprise': 3500
};

const PLAN_NAMES: Record<string, string> = {
    'basic': 'Emprendedor',
    'pro': 'Empresarial',
    'enterprise': 'Corporativo'
};

const SuperAdmin = () => {
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const { isPlatformAdmin, loading: checkingAdmin } = usePlatformAdmin();
    const queryClient = useQueryClient();
    const { profile } = useUserProfile();

    // Navegación y Filtros
    const [mainTab, setMainTab] = useState<string>("clients");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring" | "expired" | "inactive" | "pending_payment">("all");
    const [planFilter, setPlanFilter] = useState<string>("all");
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Estado para cambio/asignación de contraseña de cliente
    const [changingPasswordStore, setChangingPasswordStore] = useState<{
        id: string;
        store_name: string;
        email: string;
    } | null>(null);
    const [newPasswordInput, setNewPasswordInput] = useState<string>("");
    const [showPasswordInModal, setShowPasswordInModal] = useState<boolean>(true);
    const [isSendingResetEmail, setIsSendingResetEmail] = useState<boolean>(false);

    const generateRandomPassword = () => {
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
        const numbers = "23456789";
        let pass = "Cobro";
        for (let i = 0; i < 3; i++) {
            pass += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        pass += "@";
        for (let i = 0; i < 3; i++) {
            pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        return pass;
    };

    const handleCopyText = (text: string, id: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(id);
        toast.success(`${label} copiado`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Mutación para asignar nueva contraseña
    const setPasswordMutation = useMutation({
        mutationFn: async ({ storeId, newPassword }: { storeId: string; newPassword: string }) => {
            // @ts-ignore
            const { data, error } = await supabase.rpc("admin_set_user_password", {
                p_store_id: storeId,
                p_new_password: newPassword
            });
            if (error) throw error;
            if (data && !(data as any).success) {
                throw new Error((data as any).message || "No se pudo actualizar la contraseña");
            }
            return data;
        },
        onSuccess: () => {
            toast.success("Contraseña actualizada con éxito");
            setChangingPasswordStore(null);
        },
        onError: (err: any) => {
            toast.error("Error al cambiar contraseña: " + err.message);
        }
    });

    const handleSendResetEmail = async (email: string) => {
        if (!email) {
            toast.error("Este usuario no tiene correo registrado");
            return;
        }
        setIsSendingResetEmail(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth?reset=true`
            });
            if (error) throw error;
            toast.success(`Enlace de restablecimiento enviado a ${email}`);
        } catch (err: any) {
            toast.error("Error al enviar enlace: " + err.message);
        } finally {
            setIsSendingResetEmail(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    // 1. Obtener Todas las Tiendas (RPC SECURE)
    const { data: stores, isLoading: loadingStores, isRefetching: refetchingStores, refetch: refetchStores } = useQuery<any[]>({
        queryKey: ["admin-all-stores"],
        enabled: isPlatformAdmin,
        queryFn: async () => {
            // @ts-ignore - Supabase RPC type issue
            const { data, error } = await supabase.rpc("get_all_stores_admin");
            if (error) {
                toast.error("Error cargando tiendas: " + error.message);
                return [];
            }
            return (data as any) || [];
        },
    });

    // 2. Obtener Reportes de Pago
    const { data: reports, isLoading: loadingReports, refetch: refetchReports } = useQuery<any[]>({
        queryKey: ["admin-pending-payments"],
        enabled: isPlatformAdmin,
        queryFn: async () => {
            // @ts-ignore
            const { data, error } = await supabase.rpc("get_payment_reports_admin");
            if (error) {
                console.error("Error fetching reports via RPC:", error);
                const { data: directData, error: directError } = await supabase
                    .from("payment_reports")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (directError) throw directError;
                return directData || [];
            }
            return (data as any) || [];
        },
    });

    // 3. Mutación Toggle Tienda
    const toggleStoreMutation = useMutation({
        mutationFn: async ({ id, currentState }: { id: string; currentState: boolean }) => {
            // @ts-ignore - Supabase RPC type issue
            const { error } = await supabase.rpc("toggle_store_status", {
                p_store_id: id,
                p_is_active: !currentState
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Estado de tienda actualizado");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
        },
        onError: (err) => {
            toast.error("Error al cambiar estado: " + err.message);
        }
    });

    // 4. Acción de Aprobar/Rechazar Pago
    const processPaymentMutation = useMutation({
        mutationFn: async ({
            id,
            status,
        }: {
            id: string;
            status: "approved" | "rejected";
        }) => {
            // @ts-ignore
            const { data, error } = await supabase.rpc("process_subscription_payment", {
                p_report_id: id,
                p_status: status,
                p_admin_note: status === "approved" ? "Aprobado desde panel maestro" : "Rechazado por administrador",
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Operación realizada con éxito");
            queryClient.invalidateQueries({ queryKey: ["admin-pending-payments"] });
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
            setSelectedProof(null);
        },
        onError: (error) => {
            toast.error("Error: " + error.message);
        },
    });

    // Helper para guardar suscripciones evitando bloqueos RLS y violaciones de Check Constraints
    const saveCompanySubscriptionAdmin = async (companyId: string, planId: string, endDateIso: string) => {
        const endDateTime = new Date(endDateIso).getTime();
        const nowTime = Date.now();
        const finalPlanId = planId || 'basic';
        const diffMs = endDateTime - nowTime;
        let daysDuration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysDuration < 0) daysDuration = 0;

        // @ts-ignore - Supabase RPC type definition
        const { data: rpcData, error: rpcError } = await supabase.rpc("admin_update_subscription", {
            p_store_id: companyId,
            p_plan_id: finalPlanId,
            p_days_duration: daysDuration
        });

        if (!rpcError && rpcData) return rpcData;
        if (rpcError) console.warn("RPC admin_update_subscription warning:", rpcError);

        const status = endDateTime > nowTime ? 'active' : 'expired';
        const { error: upsertError } = await supabase
            .from("company_subscriptions")
            .upsert({
                company_id: companyId,
                plan_id: finalPlanId,
                status: status,
                end_date: endDateIso,
                payment_method: 'other',
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id' });

        if (upsertError && rpcError) throw rpcError || upsertError;
    };

    // 5. Extender Suscripción (+30 días)
    const updateSubscriptionMutation = useMutation({
        mutationFn: async ({ companyId, planId, months }: { companyId: string, planId: string, months: number }) => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + months);
            await saveCompanySubscriptionAdmin(companyId, planId, endDate.toISOString());
        },
        onSuccess: () => {
            toast.success("Suscripción renovada por 30 días");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
        },
        onError: (err) => {
            toast.error("Error al actualizar: " + err.message);
        }
    });

    // 5.1 Edición detallada por Días o Fecha Exacta
    const [editingStoreSub, setEditingStoreSub] = useState<{
        id: string;
        store_name: string;
        currentDays: number;
        plan_name?: string;
        plan_end_date?: string;
    } | null>(null);

    const [customDaysInput, setCustomDaysInput] = useState<number>(30);
    const [customDateInput, setCustomDateInput] = useState<string>("");
    const [editMode, setEditMode] = useState<"days" | "date">("days");

    const updateStoreDaysMutation = useMutation({
        mutationFn: async ({ companyId, newEndDate, planId }: { companyId: string; newEndDate: string; planId?: string }) => {
            await saveCompanySubscriptionAdmin(companyId, planId || 'basic', newEndDate);
        },
        onSuccess: () => {
            toast.success("Días de suscripción actualizados con éxito");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
            setEditingStoreSub(null);
        },
        onError: (err: any) => {
            toast.error("Error al actualizar días: " + err.message);
        }
    });

    const handleSaveStoreDays = () => {
        if (!editingStoreSub) return;
        let targetEndDate: string;

        if (editMode === "days") {
            const daysToAdd = Number(customDaysInput);
            const d = new Date();
            d.setDate(d.getDate() + daysToAdd);
            if (daysToAdd <= 0) d.setHours(0, 0, 0, 0);
            targetEndDate = d.toISOString();
        } else {
            if (!customDateInput) {
                toast.error("Por favor selecciona una fecha válida");
                return;
            }
            const d = new Date(customDateInput + "T23:59:59");
            targetEndDate = d.toISOString();
        }

        updateStoreDaysMutation.mutate({
            companyId: editingStoreSub.id,
            newEndDate: targetEndDate,
            planId: editingStoreSub.plan_name
        });
    };

    // Cambiar plan conservando la fecha de vencimiento actual
    const handleChangeStorePlan = (store: any, newPlan: string) => {
        const currentEnd = store.plan_end_date ? new Date(store.plan_end_date) : null;
        const now = new Date();
        const targetEnd = (currentEnd && currentEnd > now)
            ? currentEnd.toISOString()
            : new Date(now.setDate(now.getDate() + 30)).toISOString();

        updateStoreDaysMutation.mutate({
            companyId: store.id,
            newEndDate: targetEnd,
            planId: newPlan
        });
    };

    // 6. Eliminar tienda y usuario dueño
    const deleteStoreMutation = useMutation({
        mutationFn: async (storeId: string) => {
            // @ts-ignore
            const { data, error } = await supabase.rpc("delete_store_and_owner", {
                p_store_id: storeId
            });
            if (error) throw error;
            if (data && !(data as any).success) {
                throw new Error((data as any).message || "Error al eliminar");
            }
            return data;
        },
        onSuccess: () => {
            toast.success("Tienda y usuario eliminados permanentemente");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
        },
        onError: (err: any) => {
            toast.error("Error al eliminar la tienda: " + err.message);
        }
    });

    const handleDeleteStore = (storeId: string, storeName: string) => {
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la tienda "${storeName}" y su usuario asociado? Esta acción borrará todas las ventas, productos y datos asociados del negocio.`)) {
            deleteStoreMutation.mutate(storeId);
        }
    };

    const getPublicUrl = (path: string) => {
        if (!path) return "";
        const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
        return data.publicUrl;
    };

    // 7. Configuración Global
    const { data: globalSettings, refetch: refetchGlobalSettings } = useQuery({
        queryKey: ["admin-global-settings"],
        enabled: isPlatformAdmin,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("admin_global_settings")
                .select("*")
                .eq("id", "notification_email")
                .maybeSingle();
            if (error) return { value: "haroldrospa@gmail.com" };
            return data || { value: "haroldrospa@gmail.com" };
        }
    });

    const [editingEmail, setEditingEmail] = useState("");
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);

    const handleSaveGlobalEmail = async () => {
        if (!editingEmail.includes("@")) {
            toast.error("Correo inválido");
            return;
        }
        setIsSavingGlobal(true);
        try {
            const { error } = await supabase
                .from("admin_global_settings")
                .upsert({ id: "notification_email", value: editingEmail.toLowerCase() });
            if (error) throw error;
            toast.success("Configuración guardada");
            refetchGlobalSettings();
        } catch (err: any) {
            toast.error("Error al guardar: " + err.message);
        } finally {
            setIsSavingGlobal(false);
        }
    };

    React.useEffect(() => {
        if (globalSettings?.value) {
            setEditingEmail(globalSettings.value);
        }
    }, [globalSettings]);

    // Conteo y Cálculos Generales
    const totalStoresCount = stores?.length || 0;
    const activeCount = stores?.filter((s: any) => s.is_active).length || 0;
    const inactiveCount = stores?.filter((s: any) => !s.is_active).length || 0;
    
    const expiringSoonCount = stores?.filter((s: any) => {
        if (!s.plan_end_date || !s.is_active) return false;
        const days = getDaysRemaining(s.plan_end_date);
        return days > 0 && days <= 7;
    }).length || 0;

    const expiredCount = stores?.filter((s: any) => {
        if (!s.plan_end_date) return true;
        return getDaysRemaining(s.plan_end_date) <= 0;
    }).length || 0;

    const pendingReports = reports?.filter(r => r.status === "pending") || [];
    const pendingReportsCount = pendingReports.length;

    // Cálculo Realista de MRR
    const mrrTotal = stores?.reduce((sum: number, store: any) => {
        if (store.is_active && store.plan_name) {
            return sum + (PLAN_PRICES[store.plan_name] || 0);
        }
        return sum;
    }, 0) || 0;

    // LÓGICA DE FILTRADO DE CLIENTES
    const filteredStores = stores?.filter((store: any) => {
        // 1. Filtro de Texto
        const searchLower = searchTerm.toLowerCase().trim();
        if (searchLower) {
            const matchesSearch =
                (store.store_name?.toLowerCase() || "").includes(searchLower) ||
                (store.store_code?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_email?.toLowerCase() || "").includes(searchLower) ||
                (store.id?.toLowerCase() || "").includes(searchLower);
            if (!matchesSearch) return false;
        }

        // 2. Filtro de Plan
        if (planFilter !== "all") {
            if (planFilter === "none") {
                if (store.plan_name && store.plan_name !== 'Sin Plan') return false;
            } else if (store.plan_name !== planFilter) {
                return false;
            }
        }

        // 3. Filtro de Estado
        const daysRemaining = store.plan_end_date ? getDaysRemaining(store.plan_end_date) : 0;
        const isExpiringSoon = store.is_active && store.plan_end_date && daysRemaining > 0 && daysRemaining <= 7;
        const isExpired = !store.plan_end_date || daysRemaining <= 0;
        const hasPendingReport = pendingReports.some(r => r.company_id === store.id);

        if (statusFilter === "active") return store.is_active;
        if (statusFilter === "inactive") return !store.is_active;
        if (statusFilter === "expiring") return isExpiringSoon;
        if (statusFilter === "expired") return isExpired;
        if (statusFilter === "pending_payment") return hasPendingReport;

        return true;
    });

    if (checkingAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
        );
    }

    if (!isPlatformAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
                <Card className="w-full max-w-md border-rose-500/30 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl relative z-10 rounded-2xl overflow-hidden">
                    <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-red-400 to-rose-500" />
                    <CardHeader className="text-center pb-2 pt-6">
                        <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                            <ShieldAlert className="w-9 h-9 text-rose-400" />
                        </div>
                        <Badge variant="outline" className="mx-auto bg-rose-950/60 text-rose-300 border-rose-800 text-[10px] uppercase font-bold tracking-widest px-3 py-1 mb-2">
                            🔒 ACCESO RESTRINGIDO
                        </Badge>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">
                            No autorizado
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs mt-1">
                            Tu cuenta ({profile?.email || 'sesión actual'}) no tiene permisos de administrador general.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 pb-6">
                        <Button
                            onClick={() => (window.location.href = '/dashboard')}
                            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl"
                        >
                            Volver a mi tienda
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl animate-fade-in text-foreground pb-24 min-h-screen">
            {/* HEADER PRINCIPAL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-border/60 gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                            Panel Maestro
                        </h1>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs font-bold gap-1 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Super Admin
                        </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                        <span>Control de clientes, suscripciones y transferencias bancarias</span>
                        <span className="hidden sm:inline text-muted-foreground/40">•</span>
                        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <User className="h-3 w-3" /> {profile?.email}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            refetchStores();
                            refetchReports();
                            toast.success("Datos actualizados");
                        }}
                        disabled={refetchingStores}
                        className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border/80 hover:bg-muted"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refetchingStores ? 'animate-spin text-emerald-500' : ''}`} />
                        <span>Actualizar</span>
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleLogout}
                        className="h-9 px-3 gap-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Salir</span>
                    </Button>
                </div>
            </div>

            {/* BARRA DE 4 KPIs CONSOLIDADOS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {/* 1. Clientes Activos */}
                <Card 
                    className="border border-border/50 bg-card/60 hover:border-emerald-500/40 transition-all rounded-2xl shadow-sm cursor-pointer group"
                    onClick={() => {
                        setStatusFilter("active");
                        setMainTab("clients");
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Clientes Activos
                        </CardTitle>
                        <div className="h-7 w-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                            <Users className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3.5">
                        <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                            {activeCount}
                            <span className="text-xs font-semibold text-muted-foreground ml-1.5 font-normal">
                                / {totalStoresCount}
                            </span>
                        </div>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            {totalStoresCount > 0 ? Math.round((activeCount / totalStoresCount) * 100) : 0}% del total operativo
                        </p>
                    </CardContent>
                </Card>

                {/* 2. MRR Estimado */}
                <Card className="border border-border/50 bg-card/60 hover:border-blue-500/40 transition-all rounded-2xl shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Ingreso Mensual (MRR)
                        </CardTitle>
                        <div className="h-7 w-7 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3.5">
                        <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
                            RD$ {mrrTotal.toLocaleString()}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Planes activos (895 / 1,495 RD)
                        </p>
                    </CardContent>
                </Card>

                {/* 3. Próximos a Vencer (<= 7 días) */}
                <Card 
                    className={`border transition-all rounded-2xl shadow-sm cursor-pointer group ${
                        expiringSoonCount > 0 
                            ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500' 
                            : 'border-border/50 bg-card/60 hover:border-border'
                    }`}
                    onClick={() => {
                        setStatusFilter("expiring");
                        setMainTab("clients");
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Por Vencer (≤ 7d)
                        </CardTitle>
                        <div className={`h-7 w-7 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                            expiringSoonCount > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground'
                        }`}>
                            <Clock className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3.5">
                        <div className={`text-2xl sm:text-3xl font-black tracking-tight ${expiringSoonCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
                            {expiringSoonCount}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {expiringSoonCount > 0 ? 'Click para filtrar y avisar' : 'Sin alertas de vencimiento'}
                        </p>
                    </CardContent>
                </Card>

                {/* 4. Pagos Pendientes */}
                <Card 
                    className={`border transition-all rounded-2xl shadow-sm cursor-pointer group ${
                        pendingReportsCount > 0 
                            ? 'border-orange-500/50 bg-orange-500/5 hover:border-orange-500' 
                            : 'border-border/50 bg-card/60 hover:border-border'
                    }`}
                    onClick={() => setMainTab("payments")}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Pagos por Validar
                        </CardTitle>
                        <div className={`h-7 w-7 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                            pendingReportsCount > 0 ? 'bg-orange-500/20 text-orange-500 animate-pulse' : 'bg-muted text-muted-foreground'
                        }`}>
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3.5">
                        <div className={`text-2xl sm:text-3xl font-black tracking-tight ${pendingReportsCount > 0 ? 'text-orange-500' : 'text-foreground'}`}>
                            {pendingReportsCount}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {pendingReportsCount > 0 ? 'Transferencias para revisar' : 'Al día, sin transferencias'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ALERTA RÁPIDA DE PAGOS PENDIENTES SI EXISTEN */}
            {pendingReportsCount > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-500 shrink-0">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-foreground">
                                {pendingReportsCount === 1 ? '1 transferencia pendiente de validación' : `${pendingReportsCount} transferencias pendientes de validación`}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Revisa los comprobantes bancarios para activar o renovar los negocios inmediatamente.
                            </p>
                        </div>
                    </div>
                    <Button 
                        size="sm"
                        onClick={() => setMainTab("payments")}
                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0"
                    >
                        Revisar Comprobantes
                    </Button>
                </div>
            )}

            {/* SISTEMA DE PESTAÑAS PRINCIPAL */}
            <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
                <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/50 h-auto flex flex-wrap gap-1">
                    <TabsTrigger 
                        value="clients" 
                        className="rounded-xl font-bold text-xs px-4 py-2 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                    >
                        <Building2 className="h-4 w-4 text-emerald-500" />
                        <span>Control de Clientes</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            {filteredStores?.length || 0}
                        </Badge>
                    </TabsTrigger>

                    <TabsTrigger 
                        value="payments" 
                        className="rounded-xl font-bold text-xs px-4 py-2 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative"
                    >
                        <CreditCard className="h-4 w-4 text-orange-500" />
                        <span>Pagos & Comprobantes</span>
                        {pendingReportsCount > 0 && (
                            <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">
                                {pendingReportsCount}
                            </Badge>
                        )}
                    </TabsTrigger>

                    <TabsTrigger 
                        value="metrics" 
                        className="rounded-xl font-bold text-xs px-4 py-2 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                    >
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <span>Distribución & MRR</span>
                    </TabsTrigger>

                    <TabsTrigger 
                        value="settings" 
                        className="rounded-xl font-bold text-xs px-4 py-2 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                    >
                        <Settings className="h-4 w-4 text-slate-400" />
                        <span>Configuración</span>
                    </TabsTrigger>
                </TabsList>

                {/* ============================================================== */}
                {/* TAB 1: CONTROL DE CLIENTES (FRONT & CENTER) */}
                {/* ============================================================== */}
                <TabsContent value="clients" className="space-y-4 outline-none">
                    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="p-4 sm:p-5 border-b border-border/40 space-y-4">
                            {/* Barra de Filtros Rápidos */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                {/* Buscador */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por negocio, código, email o ID..."
                                        className="pl-9 pr-8 h-9 text-xs rounded-xl bg-background/80 border-border/60 focus:border-emerald-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Filtro por Plan */}
                                <div className="flex items-center gap-2">
                                    <Select value={planFilter} onValueChange={setPlanFilter}>
                                        <SelectTrigger className="w-[170px] h-9 text-xs rounded-xl bg-background/80 border-border/60">
                                            <SelectValue placeholder="Filtrar por Plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los Planes</SelectItem>
                                            <SelectItem value="basic">Plan Emprendedor</SelectItem>
                                            <SelectItem value="pro">Plan Empresarial</SelectItem>
                                            <SelectItem value="enterprise">Plan Corporativo</SelectItem>
                                            <SelectItem value="none">Sin Plan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Píldoras de Estado (Quick Filter Pills) */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {[
                                    { id: "all", label: "Todos", count: totalStoresCount },
                                    { id: "active", label: "Activos", count: activeCount, color: "text-emerald-500" },
                                    { id: "expiring", label: "Por Vencer (≤7d)", count: expiringSoonCount, color: "text-amber-500" },
                                    { id: "expired", label: "Vencidos", count: expiredCount, color: "text-rose-500" },
                                    { id: "inactive", label: "Inactivos", count: inactiveCount, color: "text-slate-400" },
                                    ...(pendingReportsCount > 0 ? [{ id: "pending_payment", label: "Con Pago Pendiente", count: pendingReportsCount, color: "text-orange-500" }] : [])
                                ].map((pill) => {
                                    const isSelected = statusFilter === pill.id;
                                    return (
                                        <button
                                            key={pill.id}
                                            onClick={() => setStatusFilter(pill.id as any)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                                isSelected 
                                                    ? 'bg-foreground text-background border-foreground shadow-sm' 
                                                    : 'bg-background/60 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                                            }`}
                                        >
                                            <span>{pill.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                                                isSelected ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {pill.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {loadingStores ? (
                                <div className="flex flex-col items-center justify-center p-16 space-y-3">
                                    <Loader2 className="animate-spin h-8 w-8 text-emerald-500" />
                                    <p className="text-xs text-muted-foreground font-medium">Cargando base de clientes...</p>
                                </div>
                            ) : filteredStores?.length === 0 ? (
                                <div className="text-center p-16 text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                                        <Building2 className="h-6 w-6 opacity-40" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-sm text-foreground">No se encontraron clientes</p>
                                        <p className="text-xs">Prueba cambiando los filtros o el término de búsqueda.</p>
                                    </div>
                                    {(searchTerm || statusFilter !== "all" || planFilter !== "all") && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSearchTerm("");
                                                setStatusFilter("all");
                                                setPlanFilter("all");
                                            }}
                                            className="h-8 text-xs mt-2 rounded-xl"
                                        >
                                            Limpiar Filtros
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow className="border-b border-border/50 hover:bg-transparent">
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 pl-5">
                                                    Negocio / Tienda
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                                                    Propietario (Email)
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                                                    Plan Asignado
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                                                    Vencimiento
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5">
                                                    Extender
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 text-center">
                                                    Activa
                                                </TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3.5 pr-5 text-right">
                                                    Acción
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredStores?.map((store: any) => {
                                                const daysRemaining = store.plan_end_date ? getDaysRemaining(store.plan_end_date) : 0;
                                                const hasPlan = !!store.plan_name && store.plan_name !== 'Sin Plan';
                                                const isExpiringSoon = store.is_active && store.plan_end_date && daysRemaining > 0 && daysRemaining <= 7;
                                                const isExpired = !store.plan_end_date || daysRemaining <= 0;
                                                const hasPendingReport = pendingReports.some(r => r.company_id === store.id);

                                                return (
                                                    <TableRow 
                                                        key={store.id} 
                                                        className="hover:bg-muted/40 transition-colors border-b border-border/30 group"
                                                    >
                                                        {/* COL 1: NEGOCIO */}
                                                        <TableCell className="py-3.5 pl-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-500 text-xs shrink-0 shadow-sm">
                                                                    {(store.store_name || 'T')[0].toUpperCase()}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-bold text-sm text-foreground truncate max-w-[180px]" title={store.store_name}>
                                                                            {store.store_name || "Sin Nombre"}
                                                                        </span>
                                                                        {hasPendingReport && (
                                                                            <Badge className="bg-orange-500/15 text-orange-500 border border-orange-500/30 text-[9px] h-4.5 px-1.5 font-bold shrink-0 animate-pulse">
                                                                                PAGO PENDIENTE
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <span 
                                                                            onClick={() => handleCopyText(store.store_code || store.id.slice(0, 8), `code-${store.id}`, 'Código')}
                                                                            className="text-[10px] text-muted-foreground font-mono bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                                                            title="Click para copiar código"
                                                                        >
                                                                            {store.store_code || store.id.slice(0, 8)}
                                                                        </span>
                                                                        {store.created_at && (
                                                                            <span className="text-[10px] text-muted-foreground/60">
                                                                                • {new Date(store.created_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric' })}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 2: PROPIETARIO */}
                                                        <TableCell className="py-3.5">
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                                                                <span className="truncate max-w-[150px] select-all font-medium text-foreground/80" title={store.owner_email}>
                                                                    {store.owner_email || "Sin correo"}
                                                                </span>
                                                                {store.owner_email && (
                                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                                        <button
                                                                            onClick={() => handleCopyText(store.owner_email, `email-${store.id}`, 'Correo')}
                                                                            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                                                            title="Copiar correo"
                                                                        >
                                                                            {copiedField === `email-${store.id}` ? (
                                                                                <Check className="h-3 w-3 text-emerald-500" />
                                                                            ) : (
                                                                                <Copy className="h-3 w-3" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setChangingPasswordStore({
                                                                                    id: store.id,
                                                                                    store_name: store.store_name || "Tienda",
                                                                                    email: store.owner_email
                                                                                });
                                                                                setNewPasswordInput(generateRandomPassword());
                                                                                setShowPasswordInModal(true);
                                                                            }}
                                                                            className="text-muted-foreground hover:text-amber-500 p-0.5 rounded transition-colors"
                                                                            title="Ver / Asignar Contraseña a este cliente"
                                                                        >
                                                                            <Key className="h-3.5 w-3.5 text-amber-500/80 hover:text-amber-400" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 3: PLAN */}
                                                        <TableCell className="py-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <Select
                                                                    value={store.plan_name || "basic"}
                                                                    onValueChange={(newPlan) => handleChangeStorePlan(store, newPlan)}
                                                                >
                                                                    <SelectTrigger className="w-[130px] h-8 text-xs font-semibold rounded-xl bg-background/60 border-border/60">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="basic">🌱 Emprendedor</SelectItem>
                                                                        <SelectItem value="pro">⭐ Empresarial</SelectItem>
                                                                        <SelectItem value="enterprise">🏢 Corporativo</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 4: VENCIMIENTO */}
                                                        <TableCell className="py-3.5">
                                                            <button
                                                                onClick={() => {
                                                                    const days = store.plan_end_date ? getDaysRemaining(store.plan_end_date) : 0;
                                                                    setEditingStoreSub({
                                                                        id: store.id,
                                                                        store_name: store.store_name || "Tienda",
                                                                        currentDays: days,
                                                                        plan_name: store.plan_name || "basic",
                                                                        plan_end_date: store.plan_end_date
                                                                    });
                                                                    setCustomDaysInput(days > 0 ? days : 30);
                                                                    if (store.plan_end_date) {
                                                                        try {
                                                                            setCustomDateInput(new Date(store.plan_end_date).toISOString().split('T')[0]);
                                                                        } catch (e) {
                                                                            setCustomDateInput(new Date().toISOString().split('T')[0]);
                                                                        }
                                                                    } else {
                                                                        const d = new Date();
                                                                        d.setDate(d.getDate() + 30);
                                                                        setCustomDateInput(d.toISOString().split('T')[0]);
                                                                    }
                                                                }}
                                                                title="Haz clic para modificar la fecha de vencimiento"
                                                                className={`inline-flex items-center gap-2 py-1 px-2.5 rounded-xl border text-left transition-all ${
                                                                    isExpired 
                                                                        ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20' 
                                                                        : isExpiringSoon 
                                                                            ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' 
                                                                            : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className={`text-xs font-bold flex items-center gap-1 ${
                                                                        isExpired 
                                                                            ? 'text-rose-500' 
                                                                            : isExpiringSoon 
                                                                                ? 'text-amber-500' 
                                                                                : 'text-emerald-500'
                                                                    }`}>
                                                                        {isExpiringSoon && <Clock className="h-3 w-3 animate-pulse" />}
                                                                        {daysRemaining > 0 ? `${daysRemaining} días` : 'Vencido'}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                                        {store.plan_end_date ? new Date(store.plan_end_date).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha'}
                                                                    </span>
                                                                </div>
                                                                <Pencil className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
                                                            </button>
                                                        </TableCell>

                                                        {/* COL 5: EXTENDER RÁPIDO */}
                                                        <TableCell className="py-3.5">
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-8 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold px-2.5 gap-1 rounded-xl shadow-none"
                                                                onClick={() => updateSubscriptionMutation.mutate({
                                                                    companyId: store.id,
                                                                    planId: store.plan_name || 'basic',
                                                                    months: 1
                                                                })}
                                                                title="Extender 30 días de suscripción"
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                                <span>+30d</span>
                                                            </Button>
                                                        </TableCell>

                                                        {/* COL 6: ESTADO SWITCH */}
                                                        <TableCell className="py-3.5 text-center">
                                                            <div className="flex justify-center items-center">
                                                                <Switch
                                                                    checked={store.is_active}
                                                                    onCheckedChange={() => toggleStoreMutation.mutate({ id: store.id, currentState: store.is_active })}
                                                                    disabled={toggleStoreMutation.isPending}
                                                                    title={store.is_active ? "Tienda Activa (Click para suspender)" : "Tienda Suspendida (Click para activar)"}
                                                                />
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 7: ELIMINAR */}
                                                        <TableCell className="py-3.5 pr-5 text-right">
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"
                                                                disabled={deleteStoreMutation.isPending}
                                                                onClick={() => handleDeleteStore(store.id, store.store_name)}
                                                                title="Eliminar Tienda"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============================================================== */}
                {/* TAB 2: PAGOS Y COMPROBANTES DE TRANSFERENCIA */}
                {/* ============================================================== */}
                <TabsContent value="payments" className="space-y-6 outline-none">
                    {/* Pagos Pendientes */}
                    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-border/40">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-orange-500" />
                                Pagos por Validar ({pendingReportsCount})
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Valida y confirma las transferencias manuales para renovar o activar las suscripciones de los comercios.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loadingReports ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : pendingReportsCount === 0 ? (
                                <div className="text-center p-12 text-muted-foreground flex flex-col items-center gap-2">
                                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <CheckCircle className="h-6 w-6" />
                                    </div>
                                    <p className="font-semibold text-sm text-foreground">Todo al día</p>
                                    <p className="text-xs">No hay transferencias pendientes de revisión en este momento.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-b border-border/40">
                                            <TableHead className="pl-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Negocio</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Banco</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comprobante</TableHead>
                                            <TableHead className="pr-5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingReports.map((report: any) => (
                                            <TableRow key={report.id} className="hover:bg-muted/40 transition-colors border-b border-border/30">
                                                <TableCell className="pl-5 text-xs font-medium">
                                                    {new Date(report.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm text-foreground">
                                                            {report.store_name || "Desconocido"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                            ID: {report.company_id?.slice(0, 8)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] font-semibold">
                                                        {report.bank_name || 'Banreservas'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                    RD$ {(report.amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs font-semibold rounded-xl gap-1.5 border-border/60 hover:bg-muted"
                                                        onClick={() => setSelectedProof(getPublicUrl(report.proof_url))}
                                                    >
                                                        <Eye className="h-3.5 w-3.5 text-primary" />
                                                        Ver Comprobante
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="pr-5 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 px-2.5 text-xs border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded-xl"
                                                            onClick={() =>
                                                                processPaymentMutation.mutate({
                                                                    id: report.id,
                                                                    status: "rejected",
                                                                })
                                                            }
                                                            disabled={processPaymentMutation.isPending}
                                                        >
                                                            <XCircle className="h-3.5 w-3.5 mr-1" />
                                                            Rechazar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm"
                                                            onClick={() =>
                                                                processPaymentMutation.mutate({
                                                                    id: report.id,
                                                                    status: "approved",
                                                                })
                                                            }
                                                            disabled={processPaymentMutation.isPending}
                                                        >
                                                            {processPaymentMutation.isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                            ) : (
                                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                            )}
                                                            Aprobar
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Historial de Pagos Procesados */}
                    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-border/40">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <History className="h-5 w-5 text-blue-500" />
                                Historial de Pagos Procesados
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Registro de transferencias que ya fueron aprobadas o rechazadas previamente.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {reports?.filter(r => r.status !== "pending").length === 0 ? (
                                <div className="text-center p-10 text-muted-foreground text-xs">
                                    No hay registros históricos de pagos procesados.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-b border-border/40">
                                            <TableHead className="pl-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Negocio</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comprobante</TableHead>
                                            <TableHead className="pr-5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reports?.filter(r => r.status !== "pending").map((report: any) => (
                                            <TableRow key={report.id} className="opacity-90 hover:opacity-100 hover:bg-muted/30 transition-all border-b border-border/30">
                                                <TableCell className="pl-5 text-xs font-medium">
                                                    {new Date(report.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </TableCell>
                                                <TableCell className="text-xs font-semibold text-foreground">
                                                    {report.store_name || "Desconocido"}
                                                </TableCell>
                                                <TableCell className="text-xs font-bold">
                                                    RD$ {(report.amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg"
                                                        onClick={() => setSelectedProof(getPublicUrl(report.proof_url))}
                                                    >
                                                        <Eye className="h-3 w-3 mr-1" />
                                                        Ver
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="pr-5 text-right">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] font-bold py-0.5 px-2 rounded-full border ${
                                                            report.status === "approved" 
                                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
                                                                : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                                        }`}
                                                    >
                                                        {report.status === "approved" ? "APROBADO" : "RECHAZADO"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============================================================== */}
                {/* TAB 3: DISTRIBUCIÓN Y MÉTRICAS */}
                {/* ============================================================== */}
                <TabsContent value="metrics" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Distribución de Planes */}
                        <Card className="lg:col-span-2 border border-border/60 bg-card/60 shadow-sm rounded-2xl">
                            <CardHeader className="p-5 border-b border-border/40">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Distribución de Suscripciones
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Desglose porcentual y aporte al MRR según cada plan contratado.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 space-y-6">
                                {[
                                    { name: '🌱 Emprendedor', key: 'basic', color: 'bg-emerald-500', price: 895 },
                                    { name: '⭐ Empresarial', key: 'pro', color: 'bg-blue-600', price: 1495 },
                                    { name: '🏢 Corporativo', key: 'enterprise', color: 'bg-purple-600', price: 3500 }
                                ].map((plan) => {
                                    const count = stores?.filter((s: any) => s.is_active && s.plan_name === plan.key).length || 0;
                                    const percentage = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;

                                    return (
                                        <div key={plan.key} className="space-y-1.5">
                                            <div className="flex justify-between text-xs sm:text-sm font-semibold">
                                                <span className="text-foreground">{plan.name}</span>
                                                <span className="text-muted-foreground font-mono">
                                                    {count} negocios ({percentage}%) • <strong className="text-foreground font-bold">RD$ {(count * plan.price).toLocaleString()}</strong>
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${plan.color} rounded-full transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Sin Plan */}
                                {(() => {
                                    const count = stores?.filter((s: any) => s.is_active && (!s.plan_name || s.plan_name === 'Sin Plan')).length || 0;
                                    const percentage = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
                                    return (
                                        <div className="space-y-1.5 pt-2 border-t border-border/40">
                                            <div className="flex justify-between text-xs sm:text-sm font-semibold">
                                                <span className="text-muted-foreground">Sin Plan Asignado</span>
                                                <span className="text-muted-foreground font-mono">{count} ({percentage}%)</span>
                                            </div>
                                            <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-slate-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* Resumen Histórico */}
                        <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl flex flex-col justify-between">
                            <CardHeader className="p-5 border-b border-border/40">
                                <CardTitle className="text-base font-bold">Resumen de Facturación</CardTitle>
                                <CardDescription className="text-xs">
                                    Cifras consolidadas del sistema.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 space-y-5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-muted-foreground">Total Recaudado (Histórico)</span>
                                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                                        RD$ {((reports || []).filter((r: any) => r.status === 'approved').reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0)).toLocaleString()}
                                    </span>
                                </div>
                                <div className="border-t border-dashed border-border/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-muted-foreground">Próximos Vencimientos (7d)</span>
                                    <span className="text-base sm:text-lg font-black text-amber-500">
                                        {expiringSoonCount}
                                    </span>
                                </div>
                                <div className="border-t border-dashed border-border/60" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-muted-foreground">Negocios Registrados</span>
                                    <span className="text-base sm:text-lg font-black text-foreground">
                                        {totalStoresCount}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ============================================================== */}
                {/* TAB 4: CONFIGURACIÓN GENERAL */}
                {/* ============================================================== */}
                <TabsContent value="settings" className="space-y-6 outline-none">
                    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl max-w-2xl">
                        <CardHeader className="p-5 border-b border-border/40">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Settings className="h-5 w-5 text-muted-foreground" />
                                Configuración de Alertas & Notificaciones
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Configura el correo de administrador donde se notifican transferencias bancarias y actividades del sistema.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="admin-email" className="text-xs font-bold text-foreground">
                                    Correo de Notificaciones de Pagos
                                </Label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input 
                                        id="admin-email"
                                        placeholder="admin@ejemplo.com"
                                        className="h-10 text-xs rounded-xl bg-background/80 border-border/60 flex-1"
                                        value={editingEmail}
                                        onChange={(e) => setEditingEmail(e.target.value)}
                                    />
                                    <Button 
                                        onClick={handleSaveGlobalEmail} 
                                        disabled={isSavingGlobal}
                                        className="h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
                                    >
                                        {isSavingGlobal ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                                        Guardar Correo
                                    </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Este correo recibirá alertas instantáneas cuando cualquier cliente reporte una transferencia bancaria para validación.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* MODAL PARA VER COMPROBANTE DE PAGO */}
            <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
                <DialogContent className="max-w-2xl bg-card border border-border p-5 rounded-2xl">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-base font-bold text-foreground">Comprobante de Pago</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Verifica que el monto y la fecha coincidan con la cuenta bancaria de CobroApp.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center bg-black/10 dark:bg-black/30 p-3 rounded-xl border border-border/40 mt-2">
                        {selectedProof && (
                            <img
                                src={selectedProof}
                                alt="Comprobante"
                                className="max-h-[65vh] object-contain rounded-lg shadow-md"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL MODIFICAR DÍAS DE SUSCRIPCIÓN */}
            <Dialog open={!!editingStoreSub} onOpenChange={(open) => !open && setEditingStoreSub(null)}>
                <DialogContent className="max-w-md bg-card border-border text-foreground rounded-2xl p-6">
                    <DialogHeader className="space-y-2 text-left">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Modificar Suscripción
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Negocio: <strong className="text-foreground font-semibold">{editingStoreSub?.store_name}</strong>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Selector de modo */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/60">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditMode("days")}
                                className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                                    editMode === "days" 
                                        ? "bg-card text-foreground shadow-sm" 
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Por Días Restantes
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditMode("date")}
                                className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                                    editMode === "date" 
                                        ? "bg-card text-foreground shadow-sm" 
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Por Fecha Exacta
                            </Button>
                        </div>

                        {editMode === "days" ? (
                            <div className="space-y-3">
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Días de Acceso a Otorgar:
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="3650"
                                            value={customDaysInput}
                                            onChange={(e) => setCustomDaysInput(parseInt(e.target.value) || 0)}
                                            className="h-10 font-mono text-base font-bold rounded-xl"
                                        />
                                        <span className="text-sm font-bold text-muted-foreground">Días</span>
                                    </div>
                                </div>

                                {/* Botones de acceso rápido */}
                                <div className="space-y-1.5 text-left">
                                    <span className="text-[11px] font-semibold text-muted-foreground">Accesos Rápidos:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { label: "+7 días", days: 7 },
                                            { label: "+15 días", days: 15 },
                                            { label: "+30 días (1 mes)", days: 30 },
                                            { label: "+90 días (3 meses)", days: 90 },
                                            { label: "+365 días (1 año)", days: 365 },
                                            { label: "0 días (Vencer)", days: 0 }
                                        ].map((preset) => (
                                            <Button
                                                key={preset.days}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCustomDaysInput(preset.days)}
                                                className="h-7 text-[11px] px-2.5 rounded-lg border-border/60 hover:border-emerald-500 hover:text-emerald-500"
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 text-left">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    Fecha Exacta de Vencimiento:
                                </Label>
                                <Input
                                    type="date"
                                    value={customDateInput}
                                    onChange={(e) => setCustomDateInput(e.target.value)}
                                    className="h-10 font-mono text-sm rounded-xl"
                                />
                            </div>
                        )}

                        {/* Previsualización del cálculo */}
                        <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl text-left space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                Previsualización del Vencimiento
                            </span>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {editMode === "days" ? (
                                    <>
                                        Vencerá el: <strong>{new Date(Date.now() + Number(customDaysInput) * 86400000).toLocaleDateString('es-DO')}</strong> ({customDaysInput} días de acceso)
                                    </>
                                ) : (
                                    <>
                                        Fecha fija: <strong>{customDateInput ? new Date(customDateInput + "T23:59:59").toLocaleDateString('es-DO') : 'N/A'}</strong>
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingStoreSub(null)}
                                className="h-9 text-xs rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                disabled={updateStoreDaysMutation.isPending}
                                onClick={handleSaveStoreDays}
                                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 rounded-xl gap-1.5 shadow-sm"
                            >
                                {updateStoreDaysMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Guardar Cambios
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL ASIGNAR / VER CONTRASEÑA */}
            <Dialog open={!!changingPasswordStore} onOpenChange={(open) => !open && setChangingPasswordStore(null)}>
                <DialogContent className="max-w-md bg-card border border-border text-foreground rounded-2xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2 text-left">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500">
                                <Key className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Asignar Contraseña al Cliente
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Negocio: <strong className="text-foreground font-semibold">{changingPasswordStore?.store_name}</strong>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Información del correo */}
                        <div className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between gap-2">
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                    Usuario / Email
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate select-all">
                                    {changingPasswordStore?.email || 'Sin correo'}
                                </span>
                            </div>
                            {changingPasswordStore?.email && (
                                <button
                                    onClick={() => handleCopyText(changingPasswordStore.email, 'modal-email', 'Correo')}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                                    title="Copiar correo"
                                >
                                    {copiedField === 'modal-email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            )}
                        </div>

                        {/* Campo de contraseña */}
                        <div className="space-y-2 text-left">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-foreground">
                                    Contraseña Asignada:
                                </Label>
                                <button
                                    type="button"
                                    onClick={() => setNewPasswordInput(generateRandomPassword())}
                                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Generar aleatoria
                                </button>
                            </div>

                            <div className="relative">
                                <Input
                                    type={showPasswordInModal ? "text" : "password"}
                                    value={newPasswordInput}
                                    onChange={(e) => setNewPasswordInput(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="h-10 pr-20 font-mono text-sm font-bold rounded-xl bg-background border-border/70 focus:border-amber-500"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                                        className="p-1 text-muted-foreground hover:text-foreground"
                                        title={showPasswordInModal ? "Ocultar" : "Mostrar"}
                                    >
                                        {showPasswordInModal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyText(newPasswordInput, 'modal-pass', 'Contraseña')}
                                        className="p-1 text-muted-foreground hover:text-foreground"
                                        title="Copiar contraseña"
                                    >
                                        {copiedField === 'modal-pass' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground">
                                Al guardar, el cliente podrá iniciar sesión inmediatamente con esta clave. Puedes copiarla y enviársela.
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setChangingPasswordStore(null)}
                                    className="h-9 text-xs rounded-xl"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    disabled={setPasswordMutation.isPending || !newPasswordInput || newPasswordInput.trim().length < 6}
                                    onClick={() => {
                                        if (changingPasswordStore) {
                                            setPasswordMutation.mutate({
                                                storeId: changingPasswordStore.id,
                                                newPassword: newPasswordInput.trim()
                                            });
                                        }
                                    }}
                                    className="h-9 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 rounded-xl gap-1.5 shadow-sm"
                                >
                                    {setPasswordMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                    Guardar Contraseña
                                </Button>
                            </div>

                            {/* Opción secundaria: enviar enlace de recuperación */}
                            {changingPasswordStore?.email && (
                                <div className="pt-1 text-center">
                                    <button
                                        type="button"
                                        disabled={isSendingResetEmail}
                                        onClick={() => handleSendResetEmail(changingPasswordStore.email)}
                                        className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition-colors inline-flex items-center justify-center gap-1.5"
                                    >
                                        <Mail className="h-3 w-3" />
                                        {isSendingResetEmail ? "Enviando enlace..." : "O enviar enlace de recuperación oficial al correo"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SuperAdmin;
