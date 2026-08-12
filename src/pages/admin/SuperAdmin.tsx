
import React, { useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
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
    Lock,
    Search,
    Filter,
    AlertCircle,
    Settings,
    History,
    Trash2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    MapPin,
    Globe,
    Mail,
    Smartphone,
    Key,
    LogOut,
    Radio,
    UserCheck,
    User,
    Pencil,
    Edit3,
    Clock,
    Plus
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { getDaysRemaining } from "@/lib/utils";

// INTERFAZ DE ADMINISTRACIÓN
// Ruta: /admin/super-panel

// Type definitions
type Store = {
    id: string;
    store_name: string;
    store_code: string;
    owner_email: string;
    is_active: boolean;
    plan_name: string;
    plan_end_date: string;
    created_at: string;
};

type PaymentReport = {
    id: string;
    company_id: string;
    status: string;
    amount: number;
    bank_name: string;
    proof_url: string;
    created_at: string;
    store_settings?: {
        store_name: string;
    };
};

// Helper para obtener IP y Geolocalización
const fetchClientSecurityInfo = async () => {
    let ip = "Desconocida";
    let location = "Santo Domingo, República Dominicana";
    let isp = "Proveedor de Internet Local";
    
    try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
            const data = await res.json();
            ip = data.ip || ip;
            const parts = [data.city, data.region, data.country_name].filter(Boolean);
            if (parts.length > 0) location = parts.join(", ");
            isp = data.org || data.asn || isp;
        }
    } catch (e) {
        try {
            const res2 = await fetch("https://ipwho.is/");
            if (res2.ok) {
                const data2 = await res2.json();
                ip = data2.ip || ip;
                const parts2 = [data2.city, data2.region, data2.country].filter(Boolean);
                if (parts2.length > 0) location = parts2.join(", ");
                isp = data2.connection?.isp || isp;
            }
        } catch (e2) {
            console.warn("Fallback IP check failed", e2);
        }
    }

    const userAgent = navigator.userAgent;
    let device = "Navegador Web";
    if (userAgent.includes("Windows")) device = "PC Windows";
    else if (userAgent.includes("Macintosh")) device = "Mac OS";
    else if (userAgent.includes("Android")) device = "Dispositivo Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) device = "Dispositivo iOS";

    return {
        ip,
        location,
        isp,
        device,
        timestamp: format(new Date(), "dd/MM/yyyy, hh:mm:ss a", { locale: es })
    };
};

// Helper para enviar notificación de seguridad a Haroldrospa@gmail.com
const sendSecurityNotificationEmail = async (loginInfo: {
    email: string;
    ip: string;
    location: string;
    isp: string;
    device: string;
    timestamp: string;
}) => {
    const targetEmail = "Haroldrospa@gmail.com";

    // 1. Notificación vía Supabase Edge Function
    try {
        await supabase.functions.invoke("send-otp-email", {
            body: {
                email: targetEmail,
                subject: `🚨 ALERTA DE SEGURIDAD: Inicio de sesión en Panel Maestro - CobroApp`,
                message: `
Se ha registrado un inicio de sesión exitoso al PANEL MAESTRO de CobroApp.

📍 INFORMACIÓN DETALLADA DEL ACCESO:
---------------------------------------------
• Usuario / Correo Maestro: ${loginInfo.email}
• Dirección IP: ${loginInfo.ip}
• Ubicación Geográfica: ${loginInfo.location}
• Proveedor de Internet (ISP): ${loginInfo.isp}
• Dispositivo / Sistema: ${loginInfo.device}
• Fecha y Hora Local: ${loginInfo.timestamp}
---------------------------------------------

Si reconoces este acceso, no necesitas realizar ninguna acción.
En caso contrario, cambia la contraseña maestra de inmediato.
`
            }
        });
    } catch (err) {
        console.warn("Could not send via Edge Function:", err);
    }

    // 2. Notificación vía Formspree webhook instantáneo
    try {
        await fetch("https://formspree.io/f/xknkqpoy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                _subject: `🚨 ALERTA SEGURIDAD: Inicio de sesión Panel Maestro (${loginInfo.location})`,
                email_notificacion: targetEmail,
                usuario_maestro: loginInfo.email,
                direccion_ip: loginInfo.ip,
                ubicacion_geografica: loginInfo.location,
                proveedor_isp: loginInfo.isp,
                dispositivo: loginInfo.device,
                fecha_hora: loginInfo.timestamp,
                alerta: `Inicio de sesión al Panel Maestro detectado desde ${loginInfo.location} (IP: ${loginInfo.ip})`
            })
        });
    } catch (err) {
        console.warn("Formspree fallback email attempt:", err);
    }
};

const SuperAdmin = () => {
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const [masterUser, setMasterUser] = useState("cobroapp@cobroapp.com");
    const [masterPassword, setMasterPassword] = useState("");
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem("cobroapp_master_auth") === "true";
    });

    const [lastLoginInfo, setLastLoginInfo] = useState<any>(() => {
        const saved = sessionStorage.getItem("cobroapp_master_session_info");
        return saved ? JSON.parse(saved) : null;
    });

    const [securityLogs, setSecurityLogs] = useState<any[]>(() => {
        const saved = localStorage.getItem("cobroapp_master_security_logs");
        return saved ? JSON.parse(saved) : [];
    });

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending_payment">("active");

    const queryClient = useQueryClient();
    const { profile } = useUserProfile();

    const handleMasterLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanUser = masterUser.trim().toLowerCase();
        const cleanPass = masterPassword.trim();

        const isMasterUser = cleanUser === "cobroapp@cobroapp.com" || cleanUser === "haroldrospa@gmail.com";
        const isMasterPass = cleanPass === "190421" || cleanPass === "2026" || cleanPass === "admin123";

        if (!isMasterUser || !isMasterPass) {
            toast.error("Credenciales maestras incorrectas", {
                description: "Usuario o contraseña de seguridad no válidos."
            });
            return;
        }

        setIsAuthenticating(true);
        toast.info("Verificando seguridad y obteniendo ubicación de acceso...");

        try {
            const secInfo = await fetchClientSecurityInfo();
            const fullLoginInfo = {
                email: cleanUser,
                ...secInfo,
                id: Date.now().toString()
            };

            setLastLoginInfo(fullLoginInfo);
            sessionStorage.setItem("cobroapp_master_auth", "true");
            sessionStorage.setItem("cobroapp_master_session_info", JSON.stringify(fullLoginInfo));

            const newLogs = [fullLoginInfo, ...securityLogs].slice(0, 50);
            setSecurityLogs(newLogs);
            localStorage.setItem("cobroapp_master_security_logs", JSON.stringify(newLogs));

            // Enviar correo a Haroldrospa@gmail.com
            await sendSecurityNotificationEmail(fullLoginInfo);

            setIsAuthenticated(true);
            toast.success("🔓 Acceso Maestro Autorizado", {
                description: `Notificación enviada a Haroldrospa@gmail.com | ${secInfo.location}`
            });
        } catch (err: any) {
            console.error("Auth error:", err);
            sessionStorage.setItem("cobroapp_master_auth", "true");
            setIsAuthenticated(true);
            toast.success("🔓 Acceso Maestro Autorizado");
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleMasterLogout = () => {
        sessionStorage.removeItem("cobroapp_master_auth");
        sessionStorage.removeItem("cobroapp_master_session_info");
        setIsAuthenticated(false);
        setMasterPassword("");
        toast.info("Sesión maestra cerrada");
    };

    // 3. Obtener Todas las Tiendas (USANDO RPC SECURE)
    const { data: stores, isLoading: loadingStores } = useQuery<any[]>({
        queryKey: ["admin-all-stores"],
        enabled: isAuthenticated,
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

    // 1. Obtener Reportes Pendientes
    const { data: reports, isLoading: loadingReports } = useQuery<any[]>({
        queryKey: ["admin-pending-payments"],
        enabled: isAuthenticated,
        queryFn: async () => {
            // @ts-ignore
            const { data, error } = await supabase.rpc("get_payment_reports_admin");

            if (error) {
                console.error("Error fetching reports via RPC:", error);
                // Fallback a tabla directa si el RPC falla
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

    // LÓGICA DE FILTRADO
    const filteredStores = stores?.filter((store: any) => {
        // 1. Filtro de Texto
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            (store.store_name?.toLowerCase() || "").includes(searchLower) ||
            (store.store_code?.toLowerCase() || "").includes(searchLower) ||
            (store.owner_email?.toLowerCase() || "").includes(searchLower) ||
            (store.id?.toLowerCase() || "").includes(searchLower);

        // 2. Filtro de Estado
        const hasPendingReport = reports?.some(r => r.company_id === store.id && r.status === "pending");

        const matchesStatus =
            statusFilter === "all" ? true :
                statusFilter === "active" ? store.is_active :
                    statusFilter === "inactive" ? !store.is_active :
                        statusFilter === "pending_payment" ? hasPendingReport :
                            true;

        return matchesSearch && matchesStatus;
    });

    // 4. Mutation Toggle Store
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


    // 2. Acción de Aprobar/Rechazar
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
                p_admin_note: status === "approved" ? "Aprobado desde panel admin" : "Rechazado",
            });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Operación realizada");
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
        const status = endDateTime > nowTime ? 'active' : 'expired';
        const finalPlanId = planId || 'basic';

        // 1. Intentar UPDATE directo con payment_method: 'other' (válido en el CHECK constraint company_subscriptions_payment_method_check)
        const { data: updatedRows, error: updateError } = await supabase
            .from("company_subscriptions")
            .update({
                plan_id: finalPlanId,
                status: status,
                end_date: endDateIso,
                payment_method: 'other',
                updated_at: new Date().toISOString()
            })
            .eq("company_id", companyId)
            .select();

        if (!updateError && updatedRows && updatedRows.length > 0) {
            return updatedRows;
        }

        // 2. Si la tienda no poseía una fila previa en company_subscriptions, realizar UPSERT con payment_method: 'other'
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

        if (!upsertError) return;

        // 3. Reintento final de UPDATE si no retornó filas en select previo
        const { error: finalUpdateError } = await supabase
            .from("company_subscriptions")
            .update({
                plan_id: finalPlanId,
                status: status,
                end_date: endDateIso,
                payment_method: 'other',
                updated_at: new Date().toISOString()
            })
            .eq("company_id", companyId);

        if (finalUpdateError && upsertError) {
            throw upsertError || finalUpdateError;
        }
    };

    // 5. Edición Manual de Suscripción (Meses)
    const updateSubscriptionMutation = useMutation({
        mutationFn: async ({ companyId, planId, months }: { companyId: string, planId: string, months: number }) => {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + months);
            await saveCompanySubscriptionAdmin(companyId, planId, endDate.toISOString());
        },
        onSuccess: () => {
            toast.success("Suscripción actualizada manualmente");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
        },
        onError: (err) => {
            toast.error("Error al actualizar: " + err.message);
        }
    });

    // 5.1 Estado y Mutation para edición rápida por DÍAS
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
            if (daysToAdd <= 0) {
                d.setHours(0, 0, 0, 0);
            }
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
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la tienda "${storeName}" y su usuario asociado? Esta acción borrará todas las ventas, productos y configuraciones del comercio, y no se puede deshacer.`)) {
            deleteStoreMutation.mutate(storeId);
        }
    };

    const getPublicUrl = (path: string) => {
        if (!path) return "";
        const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
        return data.publicUrl;
    };

    // 6. Global Settings Logic
    const { data: globalSettings, refetch: refetchGlobalSettings } = useQuery({
        queryKey: ["admin-global-settings"],
        enabled: isAuthenticated,
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

    // Initialize editing email when globalSettings is loaded
    React.useEffect(() => {
        if (globalSettings?.value) {
            setEditingEmail(globalSettings.value);
        }
    }, [globalSettings]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
                {/* Glowing background highlights */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <Card className="w-full max-w-md border-emerald-500/30 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl relative z-10 rounded-2xl overflow-hidden">
                    <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
                    
                    <CardHeader className="text-center pb-2 pt-6">
                        <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                            <ShieldCheck className="w-9 h-9 text-emerald-400 animate-pulse" />
                        </div>
                        <Badge variant="outline" className="mx-auto bg-emerald-950/60 text-emerald-300 border-emerald-800 text-[10px] uppercase font-bold tracking-widest px-3 py-1 mb-2">
                            🔒 ACCESO RESTRINGIDO MAESTRO
                        </Badge>
                        <CardTitle className="text-2xl font-black text-white tracking-tight">
                            Panel Maestro de CobroApp
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs mt-1">
                            Ingresa tus credenciales maestras autorizadas para ingresar.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5 pt-4">
                        <form onSubmit={handleMasterLogin} className="space-y-4">
                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-emerald-400" /> Usuario Maestro
                                </label>
                                <Input
                                    type="email"
                                    placeholder="cobroapp@cobroapp.com"
                                    value={masterUser}
                                    onChange={(e) => setMasterUser(e.target.value)}
                                    className="h-11 bg-slate-950/80 border-slate-800 text-white text-sm focus:border-emerald-500 font-mono"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Key className="h-3.5 w-3.5 text-emerald-400" /> Contraseña de Seguridad
                                </label>
                                <Input
                                    type="password"
                                    placeholder="••••••"
                                    value={masterPassword}
                                    onChange={(e) => setMasterPassword(e.target.value)}
                                    className="h-11 bg-slate-950/80 border-slate-800 text-white text-sm focus:border-emerald-500 font-mono"
                                    required
                                />
                            </div>

                            <Button 
                                type="submit" 
                                disabled={isAuthenticating}
                                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] gap-2 mt-2"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Obteniendo ubicación y notificando...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="h-4 w-4" />
                                        Verificar y Entrar al Panel Maestro
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-left space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                                <Mail className="h-4 w-4 shrink-0" />
                                Notificación de Alerta de Seguridad
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Al ingresar con <strong>cobroapp@cobroapp.com</strong> y contraseña <strong>190421</strong>, el sistema capturará automáticamente tu dirección IP y geolocalización, enviando un correo de alerta en tiempo real a <strong>Haroldrospa@gmail.com</strong>.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl animate-fade-in text-foreground pb-24 min-h-screen">
            {/* Header Limpio y Profesional con Bar de Seguridad */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b pb-4 gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Panel Maestro
                        </h1>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-semibold gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Acceso Autorizado
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        {lastLoginInfo && (
                            <>
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    <MapPin className="h-3 w-3" /> {lastLoginInfo.location} ({lastLoginInfo.ip})
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-blue-600">
                                    <Mail className="h-3 w-3" /> Notificado a Haroldrospa@gmail.com
                                </span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="h-9 gap-1.5 text-xs"
                    >
                        <Loader2 className="h-3.5 w-3.5" />
                        Actualizar
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleMasterLogout}
                        className="h-9 gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Cerrar Sesión Maestra
                    </Button>
                </div>
            </div>

            {/* KPI CARDS - Diseño Minimalista "Enterprise" */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
                {/* Clientes Activos */}
                <Card className="shadow-none border border-border/30 hover:border-primary/30 transition-colors bg-card/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Clientes Activos
                        </CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stores?.filter((s: any) => s.is_active).length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            + {stores?.filter((s: any) => s.is_active && differenceInDays(new Date(), new Date(s.created_at)) < 30).length || 0} este mes
                        </p>
                    </CardContent>
                </Card>

                {/* Espacio reservado o simplemente omitir inactivos como pidió el usuario */}

                {/* Ingreso Mensual Recurrente (MRR) */}
                <Card className="shadow-none border border-border/30 hover:border-primary/30 transition-colors bg-card/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Ingreso Mensual (MRR)
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            RD$ {(() => {
                                const planPrices: Record<string, number> = {
                                    'basic': 1500,
                                    'pro': 3000,
                                    'enterprise': 6000
                                };
                                const total = stores?.reduce((sum: number, store: any) => {
                                    if (store.is_active && store.plan_name) {
                                        return sum + (planPrices[store.plan_name] || 0);
                                    }
                                    return sum;
                                }, 0) || 0;
                                return total.toLocaleString();
                            })()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Proyección basada en planes activos
                        </p>
                    </CardContent>
                </Card>

                {/* Pagos por Revisar */}
                <Card 
                    className={`shadow-none border border-border/30 hover:border-primary/30 transition-colors bg-card/50 cursor-pointer ${statusFilter === 'pending_payment' ? 'ring-1 ring-orange-500 bg-orange-500/5' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'pending_payment' ? 'all' : 'pending_payment')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Pendientes de Revisión
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reports?.filter((r) => r.status === "pending").length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {statusFilter === 'pending_payment' ? 'Viendo solo pendientes' : 'Click para filtrar'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Distribución de Planes - Diseño Compacto */}
                <Card className="lg:col-span-2 shadow-none border border-border/30 bg-card/50">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-semibold">Distribución de Suscripciones</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-5">
                            {/* Plan Render Helper */}
                            {[
                                { name: 'Emprendedor', key: 'basic', color: 'bg-emerald-500', price: 1500 },
                                { name: 'Negocio', key: 'pro', color: 'bg-blue-600', price: 3000 },
                                { name: 'Corporativo', key: 'enterprise', color: 'bg-violet-600', price: 6000 }
                            ].map((plan) => {
                                const count = stores?.filter((s: any) => s.is_active && s.plan_name === plan.key).length || 0;
                                const activeStores = stores?.filter((s: any) => s.is_active) || [];
                                const total = activeStores.length || 1;
                                const percentage = Math.round((count / total) * 100);

                                return (
                                    <div key={plan.key} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-foreground">{plan.name}</span>
                                            <span className="text-muted-foreground">
                                                {count} ({percentage}%) <span className="mx-1">•</span> RD$ {(count * plan.price).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
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
                                const count = stores?.filter((s: any) => s.is_active && !s.plan_name).length || 0;
                                const activeStores = stores?.filter((s: any) => s.is_active) || [];
                                const total = activeStores.length || 1;
                                const percentage = Math.round((count / total) * 100);
                                return (
                                    <div className="space-y-1 pt-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-muted-foreground">Sin Plan Asignado</span>
                                            <span className="text-muted-foreground">{count} ({percentage}%)</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gray-400 rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </CardContent>
                </Card>

                {/* Métricas Resumidas */}
                <Card className="shadow-none border border-border/30 bg-card/50 flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-semibold">Resumen Total</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total Recaudado (Histórico)</span>
                            <span className="text-lg font-bold">
                                RD$ {((reports || []).filter((r: any) => r.status === 'approved').reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0)).toLocaleString()}
                            </span>
                        </div>
                        <div className="border-t border-dashed" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Próximos Vencimientos (7d)</span>
                            <span className="text-lg font-bold text-orange-600">
                                {((stores || []).filter((s: any) => {
                                    if (!s.plan_end_date || !s.is_active) return false;
                                    const days = getDaysRemaining(s.plan_end_date);
                                    return days > 0 && days <= 7;
                                }).length) || 0}
                            </span>
                        </div>
                        <div className="border-t border-dashed" />
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Negocios Activos</span>
                            <span className="text-lg font-bold text-emerald-600">
                                {stores?.filter((s: any) => s.is_active).length || 0}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="animate-fade-in delay-100">
                <h2 className="text-lg font-semibold mb-4">Gestión del Sistema</h2>

                <div className="space-y-6">
                    {/* SECCION PAGOS */}

                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="pending" className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Pendientes ({reports?.filter(r => r.status === "pending").length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Historial
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Configuración
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending">
                            <Card className="shadow-lg border-primary/10">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-orange-600" />
                                        Pagos por Aprobar
                                    </CardTitle>
                                    <CardDescription>
                                        Valida las transferencias manuales para activar suscripciones.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loadingReports ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        </div>
                                    ) : reports?.filter(r => r.status === "pending").length === 0 ? (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No hay pagos pendientes de revisión.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Empresa</TableHead>
                                                    <TableHead>Banco</TableHead>
                                                    <TableHead>Monto</TableHead>
                                                    <TableHead>Comprobante</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reports?.filter(r => r.status === "pending").map((report: any) => (
                                                    <TableRow key={report.id}>
                                                        <TableCell className="text-xs">
                                                            {new Date(report.created_at).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-sm">
                                                                    {report.store_name || "Desconocido"}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    ID: {report.company_id.slice(0, 8)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-[10px]">{report.bank_name}</Badge>
                                                        </TableCell>
                                                        <TableCell className="font-bold text-green-600 text-sm">
                                                            RD$ {report.amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-[11px]"
                                                                onClick={() => setSelectedProof(getPublicUrl(report.proof_url))}
                                                            >
                                                                <Eye className="h-3 w-3 mr-1" />
                                                                Ver
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() =>
                                                                        processPaymentMutation.mutate({
                                                                            id: report.id,
                                                                            status: "rejected",
                                                                        })
                                                                    }
                                                                    disabled={processPaymentMutation.isPending}
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 bg-green-600 hover:bg-green-700 text-white px-3 text-[11px]"
                                                                    onClick={() =>
                                                                        processPaymentMutation.mutate({
                                                                            id: report.id,
                                                                            status: "approved",
                                                                        })
                                                                    }
                                                                    disabled={processPaymentMutation.isPending}
                                                                >
                                                                    {processPaymentMutation.isPending ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                    ) : (
                                                                        <CheckCircle className="h-3 w-3 mr-1" />
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
                        </TabsContent>

                        <TabsContent value="history">
                            <Card className="shadow-lg border-primary/10">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-blue-600" />
                                        Historial de Acciones
                                    </CardTitle>
                                    <CardDescription>
                                        Registro de pagos ya procesados (Aprobados o Rechazados).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loadingReports ? (
                                        <div className="flex justify-center p-8">
                                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        </div>
                                    ) : reports?.filter(r => r.status !== "pending").length === 0 ? (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No hay registros históricos.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Empresa</TableHead>
                                                    <TableHead>Monto</TableHead>
                                                    <TableHead>Comprobante</TableHead>
                                                    <TableHead className="text-right">Resultado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reports?.filter(r => r.status !== "pending").map((report: any) => (
                                                    <TableRow key={report.id} className="opacity-80">
                                                        <TableCell className="text-[10px]">
                                                            {new Date(report.created_at).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-xs font-medium">{report.store_name}</span>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            RD$ {report.amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-[10px]"
                                                                onClick={() => setSelectedProof(getPublicUrl(report.proof_url))}
                                                            >
                                                                Ver
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge
                                                                variant={report.status === "approved" ? "default" : "destructive"}
                                                                className={`text-[10px] h-5 ${report.status === "approved" ? "bg-green-500/20 text-green-700 hover:bg-green-500/20" : ""}`}
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
                        <TabsContent value="settings">
                            <Card className="shadow-lg border-primary/10">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5 text-gray-600" />
                                        Configuración del Sistema
                                    </CardTitle>
                                    <CardDescription>
                                        Define parámetros globales para la plataforma.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <Label htmlFor="admin-email">Correo de Notificaciones de Cobro</Label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    id="admin-email"
                                                    placeholder="admin@ejemplo.com"
                                                    value={editingEmail}
                                                    onChange={(e) => setEditingEmail(e.target.value)}
                                                />
                                                <Button 
                                                    onClick={handleSaveGlobalEmail} 
                                                    disabled={isSavingGlobal}
                                                >
                                                    {isSavingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                                                </Button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Este correo recibirá las alertas cuando cualquier tienda reporte un pago o renueve su plan.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* SECCION TIENDAS */}
                    <Card className="shadow-lg border-primary/10 mt-8">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        Tiendas Registradas
                                    </CardTitle>
                                    <CardDescription>
                                        {filteredStores?.length || 0} negocios encontrados.
                                    </CardDescription>
                                </div>
                            </div>

                            {/* BARRA DE BÚSQUEDA Y FILTROS */}
                            <div className="flex flex-col sm:flex-row gap-4 mt-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre, código, email o ID..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v: any) => setStatusFilter(v)}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-muted-foreground" />
                                            <SelectValue placeholder="Estado" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="active">Activas</SelectItem>
                                        <SelectItem value="inactive">Inactivas</SelectItem>
                                        <SelectItem value="pending_payment">Pagos Pendientes 🔔</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingStores ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredStores?.length === 0 ? (
                                <div className="text-center p-12 text-muted-foreground flex flex-col items-center gap-2">
                                    <Building2 className="h-10 w-10 opacity-20" />
                                    <p>No se encontraron tiendas con estos filtros.</p>
                                </div>
                            ) : (
                                <Table className="border-collapse">
                                    <TableHeader>
                                        <TableRow className="border-b border-border/40 hover:bg-transparent">
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Nombre Tienda</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Dueño (Email)</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Plan</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4">Vence</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-transparent py-4 text-right">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStores?.map((store: any) => {
                                            const daysRemaining = store.plan_end_date ? getDaysRemaining(store.plan_end_date) : 0;
                                            const hasPlan = !!store.plan_name;

                                            return (
                                                <TableRow key={store.id} className="hover:bg-muted/30 transition-colors border-b border-border/20 group">
                                                    <TableCell className="font-medium">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span>{store.store_name || "Sin Nombre"}</span>
                                                                {reports?.some(r => r.company_id === store.id && r.status === "pending") && (
                                                                    <Badge className="bg-orange-500 text-white animate-pulse text-[10px] h-4 py-0">
                                                                        PENDIENTE
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground font-mono">{store.store_code || "N/A"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {store.owner_email || "Desconocido"}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        {hasPlan ? (
                                                            <Badge variant="secondary" className={`border-0 shadow-none font-medium ${
                                                                store.plan_name === 'basic' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                store.plan_name === 'pro' ? 'bg-blue-500/10 text-blue-500' :
                                                                store.plan_name === 'enterprise' ? 'bg-violet-500/10 text-violet-500' : ''
                                                            }`}>
                                                                {store.plan_name === 'basic' ? 'Emprendedor' :
                                                                    store.plan_name === 'pro' ? 'Negocio' :
                                                                        store.plan_name === 'enterprise' ? 'Corporativo' :
                                                                            store.plan_name}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 shadow-none font-medium">Sin Plan</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell 
                                                        className="cursor-pointer hover:bg-emerald-500/10 transition-all rounded-lg py-2 px-3 group/editcell"
                                                        title="Haz clic para modificar los días de suscripción"
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
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-bold ${daysRemaining < 7 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {daysRemaining} días
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                                    {store.plan_end_date ? new Date(store.plan_end_date).toLocaleDateString() : 'Sin fecha'}
                                                                </span>
                                                            </div>
                                                            <div className="p-1 rounded-md bg-muted/50 text-muted-foreground group-hover/editcell:bg-emerald-500 group-hover/editcell:text-white transition-all shadow-sm">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-4">
                                                        <div className="flex justify-end items-center gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <Select 
                                                                defaultValue={store.plan_name || "basic"}
                                                                onValueChange={(newPlan) => updateSubscriptionMutation.mutate({ 
                                                                    companyId: store.id, 
                                                                    planId: newPlan,
                                                                    months: 1 // Por defecto renovamos 1 mes al cambiar
                                                                })}
                                                            >
                                                                <SelectTrigger className="w-[120px] h-8 text-[11px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="basic">Emprendedor</SelectItem>
                                                                    <SelectItem value="pro">Negocio</SelectItem>
                                                                    <SelectItem value="enterprise">Corporativo</SelectItem>
                                                                </SelectContent>
                                                            </Select>

                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="h-8 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                onClick={() => updateSubscriptionMutation.mutate({
                                                                    companyId: store.id,
                                                                    planId: store.plan_name || 'basic',
                                                                    months: 1
                                                                })}
                                                            >
                                                                +30d
                                                            </Button>

                                                            <Switch
                                                                checked={store.is_active}
                                                                onCheckedChange={() => toggleStoreMutation.mutate({ id: store.id, currentState: store.is_active })}
                                                                disabled={toggleStoreMutation.isPending}
                                                            />

                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full"
                                                                disabled={deleteStoreMutation.isPending}
                                                                onClick={() => handleDeleteStore(store.id, store.store_name)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal para ver imagen */}
            <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                        <DialogDescription>
                            Verifica que el monto y la fecha coincidan con tu estado bancario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center bg-black/5 p-4 rounded-lg">
                        {selectedProof && (
                            <img
                                src={selectedProof}
                                alt="Comprobante"
                                className="max-h-[70vh] object-contain rounded shadow-lg"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* DIÁLOGO MODIFICAR DÍAS DE SUSCRIPCIÓN */}
            <Dialog open={!!editingStoreSub} onOpenChange={(open) => !open && setEditingStoreSub(null)}>
                <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white rounded-2xl p-6">
                    <DialogHeader className="space-y-2 text-left">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-white">
                                    Modificar Días de Suscripción
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-400">
                                    Tienda: <strong className="text-white">{editingStoreSub?.store_name}</strong>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Selector de modo */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditMode("days")}
                                className={`h-8 text-xs font-semibold rounded-lg transition-all ${editMode === "days" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                            >
                                Por Días Restantes
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditMode("date")}
                                className={`h-8 text-xs font-semibold rounded-lg transition-all ${editMode === "date" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}
                            >
                                Por Fecha Exacta
                            </Button>
                        </div>

                        {editMode === "days" ? (
                            <div className="space-y-3">
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-xs text-slate-300 font-semibold">
                                        Días de Acceso a Otorgar:
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="3650"
                                            value={customDaysInput}
                                            onChange={(e) => setCustomDaysInput(parseInt(e.target.value) || 0)}
                                            className="h-10 bg-slate-950 border-slate-800 text-white font-mono text-base font-bold focus:border-emerald-500"
                                        />
                                        <span className="text-sm font-bold text-slate-300">Días</span>
                                    </div>
                                </div>

                                {/* Botones de acceso rápido */}
                                <div className="space-y-1.5 text-left">
                                    <span className="text-[11px] font-semibold text-slate-400">Accesos Rápidos:</span>
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
                                                className="h-7 text-[11px] px-2.5 bg-slate-950/80 border-slate-800 text-slate-300 hover:border-emerald-500 hover:text-emerald-400"
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 text-left">
                                <Label className="text-xs text-slate-300 font-semibold">
                                    Fecha Exacta de Vencimiento:
                                </Label>
                                <Input
                                    type="date"
                                    value={customDateInput}
                                    onChange={(e) => setCustomDateInput(e.target.value)}
                                    className="h-10 bg-slate-950 border-slate-800 text-white font-mono text-sm focus:border-emerald-500"
                                />
                            </div>
                        )}

                        {/* Previsualización del cálculo */}
                        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl text-left space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                Previsualización del Vencimiento
                            </span>
                            <p className="text-xs font-semibold text-emerald-400 leading-relaxed">
                                {editMode === "days" ? (
                                    <>
                                        Vencerá el: <strong>{new Date(Date.now() + Number(customDaysInput) * 86400000).toLocaleDateString()}</strong> ({customDaysInput} días de acceso)
                                    </>
                                ) : (
                                    <>
                                        Fecha fija: <strong>{customDateInput ? new Date(customDateInput + "T23:59:59").toLocaleDateString() : 'N/A'}</strong>
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingStoreSub(null)}
                                className="h-9 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                disabled={updateStoreDaysMutation.isPending}
                                onClick={handleSaveStoreDays}
                                className="h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-4 gap-1.5 shadow-lg shadow-emerald-600/20"
                            >
                                {updateStoreDaysMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Guardar Días
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SuperAdmin;
