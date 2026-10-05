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
    Sparkles,
    Phone,
    PhoneCall,
    MessageSquare,
    MessageCircle,
    MessageSquarePlus,
    Headphones,
    CheckCircle2,
    Send,
    ChevronRight
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

export const normalizePlanId = (rawPlan: any): 'basic' | 'pro' | 'enterprise' => {
    if (!rawPlan || typeof rawPlan !== 'string') return 'basic';
    const clean = rawPlan.toLowerCase().trim();
    if (clean === 'pro' || clean.includes('empresarial') || clean.includes('profesional') || clean.includes('negocio')) {
        return 'pro';
    }
    if (clean === 'enterprise' || clean.includes('corporativo')) {
        return 'enterprise';
    }
    return 'basic';
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

    // ESTADO PARA CRM DE SEGUIMIENTO A CLIENTES NUEVOS
    const [crmFilter, setCrmFilter] = useState<string>("all");
    const [crmStore, setCrmStore] = useState<any | null>(null);
    const [newNoteFeedback, setNewNoteFeedback] = useState<string>("");
    const [newNoteStatus, setNewNoteStatus] = useState<string>("called");
    const [newNoteType, setNewNoteType] = useState<string>("call");
    const [isSendingWelcomeEmail, setIsSendingWelcomeEmail] = useState<string | null>(null);

    // ESTADO PARA EDICIÓN DE TELÉFONO DE CLIENTE
    const [editingPhoneStore, setEditingPhoneStore] = useState<{ id: string; store_name: string; phone: string } | null>(null);
    const [phoneInputValue, setPhoneInputValue] = useState<string>("");
    const [notePhoneInput, setNotePhoneInput] = useState<string>("");

    // ESTADO PARA MODAL DE REPORTES GENERADOS POR EL CLIENTE
    const [reportsStore, setReportsStore] = useState<any | null>(null);
    const [adminResponseInput, setAdminResponseInput] = useState<Record<string, string>>({});

    // 1.1 Consultar todos los reportes de soporte creados por clientes
    const { data: allSupportReports = [], refetch: refetchSupportReports } = useQuery<any[]>({
        queryKey: ["admin-all-support-reports"],
        enabled: isPlatformAdmin,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("client_support_reports")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) {
                console.warn("Could not fetch client_support_reports:", error);
                return [];
            }
            return data || [];
        }
    });

    // 1.2 Consultar todas las notas de seguimiento / llamadas
    const { data: allFollowUpNotes = [], refetch: refetchFollowUpNotes } = useQuery<any[]>({
        queryKey: ["admin-all-follow-up-notes"],
        enabled: isPlatformAdmin,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("client_follow_up_notes")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) {
                console.warn("Could not fetch client_follow_up_notes:", error);
                return [];
            }
            return data || [];
        }
    });

    // Mutación para agregar nota de llamada / contacto
    const addFollowUpNoteMutation = useMutation({
        mutationFn: async ({
            storeId,
            contactType,
            clientFeedback,
            status
        }: {
            storeId: string;
            contactType: string;
            clientFeedback: string;
            status: string;
        }) => {
            const { data, error } = await supabase
                .from("client_follow_up_notes")
                .insert({
                    store_id: storeId,
                    contact_type: contactType,
                    client_feedback: clientFeedback.trim(),
                    status: status,
                    created_by: profile?.email || "SuperAdmin"
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Nota de llamada guardada exitosamente");
            setNewNoteFeedback("");
            refetchFollowUpNotes();
            refetchStores();
        },
        onError: (err: any) => {
            toast.error("Error al guardar nota: " + err.message);
        }
    });

    // Mutación para resolver o responder reporte de cliente
    const updateReportStatusMutation = useMutation({
        mutationFn: async ({
            reportId,
            status,
            adminResponse
        }: {
            reportId: string;
            status: string;
            adminResponse?: string;
        }) => {
            const { error } = await supabase
                .from("client_support_reports")
                .update({
                    status,
                    admin_response: adminResponse?.trim() || null,
                    resolved_at: status === 'resolved' ? new Date().toISOString() : null
                })
                .eq("id", reportId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Reporte actualizado correctamente");
            refetchSupportReports();
            refetchStores();
        },
        onError: (err: any) => {
            toast.error("Error al actualizar reporte: " + err.message);
        }
    });

    // Mutación para guardar o actualizar teléfono de cliente
    const updateClientPhoneMutation = useMutation({
        mutationFn: async ({ storeId, phone }: { storeId: string; phone: string }) => {
            const clean = phone.trim();
            try {
                // @ts-ignore
                const { data, error } = await supabase.rpc("admin_update_client_phone", {
                    p_store_id: storeId,
                    p_phone: clean
                });
                if (error) throw error;
                return data;
            } catch (rpcErr) {
                console.warn("RPC admin_update_client_phone fallback to direct updates:", rpcErr);
                // Fallback directo a company_settings y profiles
                await supabase.from("company_settings").upsert({ store_id: storeId, phone: clean });
                await supabase.from("profiles").update({ phone: clean }).eq("store_id", storeId);
                return { success: true };
            }
        },
        onSuccess: () => {
            toast.success("Teléfono guardado exitosamente");
            setEditingPhoneStore(null);
            setPhoneInputValue("");
            refetchStores();
        },
        onError: (err: any) => {
            toast.error("Error al guardar teléfono: " + err.message);
        }
    });

    // Helper para reenviar correo de bienvenida
    const handleSendWelcomeEmail = async (store: any) => {
        const email = store.owner_email;
        if (!email) {
            toast.error("Este comercio no tiene correo registrado");
            return;
        }
        setIsSendingWelcomeEmail(store.id);
        const toastId = toast.loading(`Enviando correo de bienvenida a ${email}...`);
        try {
            const { error } = await supabase.functions.invoke("send-welcome-email", {
                body: {
                    email,
                    fullName: store.owner_name,
                    companyName: store.store_name,
                    storeCode: store.store_code
                }
            });
            if (error) throw error;
            toast.success(`¡Correo de bienvenida enviado exitosamente a ${email}!`, { id: toastId });
        } catch (err: any) {
            toast.error("Error al enviar correo de bienvenida: " + err.message, { id: toastId });
        } finally {
            setIsSendingWelcomeEmail(null);
        }
    };

    // Helper para generar link directo de WhatsApp
    const getWhatsAppUrl = (phone?: string, ownerName?: string, storeName?: string) => {
        if (!phone) return null;
        let clean = phone.replace(/[^0-9]/g, '');
        if (clean.length === 10) {
            clean = '1' + clean; // Prefijo República Dominicana / USA
        }
        const greeting = `Hola ${ownerName || ''}! 👋 Te saluda Harold de Cobro App. Vi que te registraste con tu negocio "${storeName || ''}". ¿Cómo te ha ido con la prueba? ¿En qué te puedo ayudar para empezar a facturar?`.trim();
        return `https://wa.me/${clean}?text=${encodeURIComponent(greeting)}`;
    };

    // Helper para formatear etiqueta de estado CRM
    const getCrmStatusConfig = (status?: string) => {
        switch (status) {
            case 'called':
                return { label: 'Llamado / En seguimiento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400' };
            case 'interested':
                return { label: 'Interesado / En prueba', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400' };
            case 'active':
                return { label: 'Convertido / Activo', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' };
            case 'unreachable':
                return { label: 'No contesta / Volver a llamar', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400' };
            case 'not_interested':
                return { label: 'No interesado', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400' };
            case 'trial':
                return { label: 'En evaluación', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:text-cyan-400' };
            default:
                return { label: 'Nuevo / Sin contactar', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/40 dark:text-yellow-400' };
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
        const finalPlanId = normalizePlanId(planId);
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

    // 5. Extender Suscripción (+30 días o +1 año)
    const updateSubscriptionMutation = useMutation({
        mutationFn: async ({ companyId, planId, months, currentEndDate }: { companyId: string, planId: string, months: number, currentEndDate?: string }) => {
            const now = new Date();
            const baseDate = (currentEndDate && new Date(currentEndDate) > now)
                ? new Date(currentEndDate)
                : now;
            const endDate = new Date(baseDate);
            endDate.setMonth(endDate.getMonth() + months);
            await saveCompanySubscriptionAdmin(companyId, planId, endDate.toISOString());
        },
        onSuccess: (_data, variables) => {
            const label = variables.months >= 12 ? `${Math.round(variables.months / 12)} año` : `${variables.months * 30} días`;
            toast.success(`Suscripción extendida por ${label}`);
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
            if (err?.message?.includes("delete_store_and_owner") || err?.message?.includes("schema cache")) {
                toast.error("Función no encontrada en Supabase. Debes ejecutar el script SQL 'delete_store_and_owner' en el Editor SQL de Supabase.", { duration: 6000 });
            } else {
                toast.error("Error al eliminar la tienda: " + err.message);
            }
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

    // Enriquecer cada tienda con reportes de soporte y notas de seguimiento CRM
    const enrichedStores = React.useMemo(() => {
        if (!stores) return [];
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        return stores.map((store: any) => {
            const storeReports = allSupportReports.filter((r: any) => r.store_id === store.id);
            const monthlyReports = storeReports.filter((r: any) => new Date(r.created_at) >= currentMonthStart);
            const storeNotes = allFollowUpNotes.filter((n: any) => n.store_id === store.id);
            const latestNote = storeNotes[0] || null;
            const followUpStatus = latestNote?.status || store.latest_follow_up_status || 'new';
            const totalReportsCount = storeReports.length + (Number(store.reports_count) || 0);
            const reportWithPhone = storeReports.find((r: any) => r.contact_phone && r.contact_phone.trim() !== '');
            const resolvedPhone = store.owner_phone || reportWithPhone?.contact_phone || '';

            return {
                ...store,
                owner_phone: resolvedPhone,
                support_reports: storeReports,
                monthly_reports_count: monthlyReports.length,
                follow_up_notes: storeNotes,
                latest_note: latestNote,
                follow_up_status: followUpStatus,
                total_reports_count: totalReportsCount
            };
        });
    }, [stores, allSupportReports, allFollowUpNotes]);


    // Conteo y Cálculos Generales
    const totalStoresCount = enrichedStores.length;
    const activeCount = enrichedStores.filter((s: any) => s.is_active).length;
    const inactiveCount = enrichedStores.filter((s: any) => !s.is_active).length;
    const newClientsCount = enrichedStores.filter((s: any) => s.follow_up_status === 'new').length;
    const storesWithReportsCount = enrichedStores.filter((s: any) => s.total_reports_count > 0).length;

    const expiringSoonCount = enrichedStores.filter((s: any) => {
        if (!s.plan_end_date || !s.is_active) return false;
        const days = getDaysRemaining(s.plan_end_date);
        return days > 0 && days <= 7;
    }).length;

    const expiredCount = enrichedStores.filter((s: any) => {
        if (!s.plan_end_date) return true;
        return getDaysRemaining(s.plan_end_date) <= 0;
    }).length;

    const pendingReports = reports?.filter(r => r.status === "pending") || [];
    const pendingReportsCount = pendingReports.length;

    // Cálculo Realista de MRR
    const mrrTotal = enrichedStores.reduce((sum: number, store: any) => {
        if (store.is_active && store.plan_name && store.plan_name !== 'Sin Plan') {
            const planKey = normalizePlanId(store.plan_name);
            return sum + (PLAN_PRICES[planKey] || 0);
        }
        return sum;
    }, 0);

    // LÓGICA DE FILTRADO DE CLIENTES
    const filteredStores = enrichedStores.filter((store: any) => {
        // 1. Filtro de Texto
        const searchLower = searchTerm.toLowerCase().trim();
        if (searchLower) {
            const matchesSearch =
                (store.store_name?.toLowerCase() || "").includes(searchLower) ||
                (store.store_code?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_email?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_name?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_phone || "").includes(searchLower) ||
                (store.id?.toLowerCase() || "").includes(searchLower);
            if (!matchesSearch) return false;
        }

        // 2. Filtro de Plan
        if (planFilter !== "all") {
            if (planFilter === "none") {
                if (store.plan_name && store.plan_name !== 'Sin Plan') return false;
            } else if (normalizePlanId(store.plan_name) !== planFilter) {
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

    // LÓGICA DE FILTRADO PARA CRM
    const filteredCrmStores = enrichedStores.filter((store: any) => {
        const searchLower = searchTerm.toLowerCase().trim();
        if (searchLower) {
            const matchesSearch =
                (store.store_name?.toLowerCase() || "").includes(searchLower) ||
                (store.store_code?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_email?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_name?.toLowerCase() || "").includes(searchLower) ||
                (store.owner_phone || "").includes(searchLower) ||
                (store.id?.toLowerCase() || "").includes(searchLower);
            if (!matchesSearch) return false;
        }

        if (crmFilter === "all") return true;
        if (crmFilter === "has_reports") return store.total_reports_count > 0;
        return store.follow_up_status === crmFilter;
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
                        value="crm" 
                        className="rounded-xl font-bold text-xs px-4 py-2 gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all relative"
                    >
                        <Headphones className="h-4 w-4 text-purple-500" />
                        <span>Seguimiento CRM</span>
                        {newClientsCount > 0 && (
                            <Badge className="bg-purple-500 hover:bg-purple-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">
                                {newClientsCount} nuevo{newClientsCount !== 1 ? 's' : ''}
                            </Badge>
                        )}
                        {storesWithReportsCount > 0 && (
                            <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">
                                {storesWithReportsCount} con reporte{storesWithReportsCount !== 1 ? 's' : ''}
                            </Badge>
                        )}
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
                                                    Seguimiento & Reportes
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
                                                                    value={normalizePlanId(store.plan_name)}
                                                                    onValueChange={(newPlan) => handleChangeStorePlan(store, newPlan)}
                                                                >
                                                                    <SelectTrigger className="w-[125px] h-7 text-xs font-medium rounded-lg bg-background/50 border-border/60 hover:bg-muted/50 px-2.5 transition-colors">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="text-xs">
                                                                        <SelectItem value="basic">Emprendedor</SelectItem>
                                                                        <SelectItem value="pro">Empresarial</SelectItem>
                                                                        <SelectItem value="enterprise">Corporativo</SelectItem>
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

                                                        {/* COL: SEGUIMIENTO & REPORTES */}
                                                        <TableCell className="py-3.5">
                                                            <div className="flex flex-col gap-1.5 min-w-[140px]">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-[9px] font-bold px-1.5 py-0 h-4.5 cursor-pointer ${getCrmStatusConfig(store.follow_up_status).color}`}
                                                                        onClick={() => {
                                                                            setCrmStore(store);
                                                                            setNewNoteStatus(store.follow_up_status || 'called');
                                                                        }}
                                                                        title="Haz clic para ver o agregar notas de llamada"
                                                                    >
                                                                        {getCrmStatusConfig(store.follow_up_status).label}
                                                                    </Badge>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setReportsStore(store)}
                                                                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition-all ${
                                                                            store.monthly_reports_count > 0
                                                                                ? store.monthly_reports_count >= 3
                                                                                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                                                                                    : 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20'
                                                                                : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                                                                        }`}
                                                                        title={`Reportes de este mes: ${store.monthly_reports_count}/3 (Total histórico: ${store.total_reports_count})`}
                                                                    >
                                                                        <MessageSquare className="h-3 w-3" />
                                                                        <span>{store.monthly_reports_count}/3 mes</span>
                                                                    </button>
                                                                </div>

                                                                {/* Acciones rápidas de contacto */}
                                                                <div className="flex items-center gap-1">
                                                                    {store.owner_phone ? (
                                                                        <>
                                                                            <a
                                                                                href={`tel:${store.owner_phone}`}
                                                                                className="h-6 px-1.5 rounded bg-muted hover:bg-emerald-500/20 hover:text-emerald-500 text-muted-foreground text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                                                                title={`Llamar a ${store.owner_phone}`}
                                                                            >
                                                                                <Phone className="h-3 w-3 text-emerald-500" />
                                                                                <span className="hidden xl:inline">{store.owner_phone}</span>
                                                                            </a>

                                                                            <a
                                                                                href={getWhatsAppUrl(store.owner_phone, store.owner_name, store.store_name) || '#'}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="h-6 w-6 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 flex items-center justify-center transition-colors"
                                                                                title="Escribir por WhatsApp"
                                                                            >
                                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                                            </a>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground/60 italic">Sin tel.</span>
                                                                    )}

                                                                    <button
                                                                        onClick={() => {
                                                                            setCrmStore(store);
                                                                            setNewNoteStatus(store.follow_up_status || 'called');
                                                                        }}
                                                                        className="h-6 px-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                                                                        title="Registrar llamada / Lo que dijo el cliente"
                                                                    >
                                                                        <PhoneCall className="h-3 w-3" />
                                                                        <span>Nota</span>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleSendWelcomeEmail(store)}
                                                                        disabled={isSendingWelcomeEmail === store.id}
                                                                        className="h-6 w-6 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 flex items-center justify-center transition-colors"
                                                                        title="Reenviar correo de bienvenida a este cliente"
                                                                    >
                                                                        {isSendingWelcomeEmail === store.id ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                            <Mail className="h-3 w-3" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 5: EXTENDER RÁPIDO */}
                                                        <TableCell className="py-3.5">

                                                            <div className="flex items-center gap-1.5">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-7 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-medium px-2 rounded-lg shadow-none transition-colors"
                                                                    onClick={() => updateSubscriptionMutation.mutate({
                                                                        companyId: store.id,
                                                                        planId: normalizePlanId(store.plan_name),
                                                                        months: 1,
                                                                        currentEndDate: store.plan_end_date
                                                                    })}
                                                                    disabled={updateSubscriptionMutation.isPending}
                                                                    title="Extender 30 días de suscripción"
                                                                >
                                                                    +30d
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline" 
                                                                    className="h-7 text-xs border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 font-medium px-2 rounded-lg shadow-none transition-colors"
                                                                    onClick={() => updateSubscriptionMutation.mutate({
                                                                        companyId: store.id,
                                                                        planId: normalizePlanId(store.plan_name),
                                                                        months: 12,
                                                                        currentEndDate: store.plan_end_date
                                                                    })}
                                                                    disabled={updateSubscriptionMutation.isPending}
                                                                    title="Extender 1 año (12 meses) de suscripción"
                                                                >
                                                                    +1 año
                                                                </Button>
                                                            </div>
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
                {/* TAB: SEGUIMIENTO CRM DE CLIENTES NUEVOS */}
                {/* ============================================================== */}
                {/* ============================================================== */}
                {/* TAB: SEGUIMIENTO CRM DE CLIENTES (DISEÑO SIMPLE Y COMPACTO) */}
                {/* ============================================================== */}
                <TabsContent value="crm" className="space-y-4 outline-none">
                    <Card className="border border-border/60 bg-card/60 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="p-4 sm:p-5 border-b border-border/40 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Headphones className="h-4 w-4 text-purple-500" />
                                        Seguimiento & Llamadas a Clientes
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Registro simple de llamadas, notas y atención a reportes generados.
                                    </CardDescription>
                                </div>

                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar cliente, teléfono o email..."
                                        className="pl-9 h-8 text-xs rounded-xl bg-background/80 border-border/60 focus:border-purple-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Píldoras de filtro limpias */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {[
                                    { id: 'all', label: 'Todos', count: enrichedStores.length },
                                    { id: 'new', label: 'Nuevos sin contactar', count: newClientsCount },
                                    { id: 'has_reports', label: 'Con Reportes', count: storesWithReportsCount },
                                    { id: 'called', label: 'Llamados / En seguimiento', count: enrichedStores.filter((s: any) => s.follow_up_status === 'called').length },
                                    { id: 'interested', label: 'Interesados', count: enrichedStores.filter((s: any) => s.follow_up_status === 'interested').length },
                                    { id: 'active', label: 'Activos / Convertidos', count: enrichedStores.filter((s: any) => s.follow_up_status === 'active').length },
                                    { id: 'unreachable', label: 'No contestan', count: enrichedStores.filter((s: any) => s.follow_up_status === 'unreachable').length },
                                ].map((pill) => {
                                    const isSelected = crmFilter === pill.id;
                                    return (
                                        <button
                                            key={pill.id}
                                            onClick={() => setCrmFilter(pill.id)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                                isSelected 
                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                                                    : 'bg-background/60 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                                            }`}
                                        >
                                            <span>{pill.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {pill.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {filteredCrmStores.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Headphones className="h-8 w-8 mx-auto mb-2 opacity-30 text-purple-500" />
                                    <p className="font-bold text-foreground text-sm">No hay clientes con este filtro</p>
                                    <p className="text-xs mt-0.5">Prueba seleccionando otro filtro de estado arriba.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-border/40 text-xs">
                                                <TableHead className="pl-5">Comercio / Cliente</TableHead>
                                                <TableHead>Contacto</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Reportes</TableHead>
                                                <TableHead className="min-w-[200px] max-w-[320px]">Última Nota / Lo que dijeron</TableHead>
                                                <TableHead className="text-right pr-5">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCrmStores.map((store: any) => {
                                                const crmStatus = getCrmStatusConfig(store.follow_up_status);
                                                const pendingStoreReports = store.support_reports.filter((r: any) => r.status === 'pending');

                                                return (
                                                    <TableRow 
                                                        key={`crm-row-${store.id}`}
                                                        className="hover:bg-muted/40 transition-colors border-b border-border/30"
                                                    >
                                                        {/* COL 1: COMERCIO */}
                                                        <TableCell className="py-3.5 pl-5">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-black text-purple-600 dark:text-purple-400 text-xs shrink-0">
                                                                    {(store.store_name || 'T')[0].toUpperCase()}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold text-xs text-foreground truncate max-w-[170px]" title={store.store_name}>
                                                                        {store.store_name || "Comercio"}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                                                        <span className="font-medium">{store.owner_name || 'Propietario'}</span>
                                                                        <span>•</span>
                                                                        <span className="font-mono bg-muted/60 px-1 rounded">{store.store_code}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 2: CONTACTO */}
                                                        <TableCell className="py-3.5">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                {store.owner_phone ? (
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <a
                                                                            href={`tel:${store.owner_phone}`}
                                                                            className="font-mono font-bold text-foreground hover:text-emerald-500 flex items-center gap-1 transition-colors text-xs"
                                                                            title={`Llamar a ${store.owner_phone}`}
                                                                        >
                                                                            <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                                            <span>{store.owner_phone}</span>
                                                                        </a>
                                                                        <a
                                                                            href={getWhatsAppUrl(store.owner_phone, store.owner_name, store.store_name) || '#'}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="h-5 w-5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 flex items-center justify-center transition-colors"
                                                                            title="Enviar WhatsApp"
                                                                        >
                                                                            <MessageCircle className="h-3 w-3" />
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setEditingPhoneStore({
                                                                                    id: store.id,
                                                                                    store_name: store.store_name || "Comercio",
                                                                                    phone: store.owner_phone || ""
                                                                                });
                                                                                setPhoneInputValue(store.owner_phone || "");
                                                                            }}
                                                                            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                                                            title="Editar número de teléfono"
                                                                        >
                                                                            <Pencil className="h-2.5 w-2.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingPhoneStore({
                                                                                id: store.id,
                                                                                store_name: store.store_name || "Comercio",
                                                                                phone: ""
                                                                            });
                                                                            setPhoneInputValue("");
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-500 hover:underline"
                                                                        title="Haz clic para registrar el teléfono de este cliente"
                                                                    >
                                                                        <Phone className="h-3 w-3" />
                                                                        <span>+ Agregar Teléfono</span>
                                                                    </button>
                                                                )}
                                                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[180px]" title={store.owner_email}>
                                                                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                                                    <span className="truncate">{store.owner_email || 'Sin correo'}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* COL 3: ESTADO CRM */}
                                                        <TableCell className="py-3.5">
                                                            <Badge 
                                                                variant="outline" 
                                                                className={`text-[10px] font-bold cursor-pointer py-0.5 px-2 ${crmStatus.color}`}
                                                                onClick={() => {
                                                                    setCrmStore(store);
                                                                    setNewNoteStatus(store.follow_up_status || 'called');
                                                                    setNotePhoneInput(store.owner_phone || '');
                                                                }}
                                                                title="Haz clic para cambiar estado o registrar nota"
                                                            >
                                                                {crmStatus.label}
                                                            </Badge>
                                                        </TableCell>

                                                        {/* COL 4: REPORTES */}
                                                        <TableCell className="py-3.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setReportsStore(store)}
                                                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                                                                    store.monthly_reports_count > 0
                                                                        ? store.monthly_reports_count >= 3
                                                                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                                                                            : 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20'
                                                                        : 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted'
                                                                }`}
                                                                title={`Reportes de este mes: ${store.monthly_reports_count}/3 (Total: ${store.total_reports_count})`}
                                                            >
                                                                <MessageSquare className="h-3 w-3" />
                                                                <span>{store.monthly_reports_count}/3 mes</span>
                                                                {pendingStoreReports.length > 0 && (
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Tiene reporte pendiente" />
                                                                )}
                                                            </button>
                                                        </TableCell>

                                                        {/* COL 5: ÚLTIMA NOTA / LO QUE DIJERON */}
                                                        <TableCell className="py-3.5 max-w-[280px]">
                                                            {store.latest_note ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <p className="text-xs text-foreground/90 italic truncate" title={store.latest_note.client_feedback}>
                                                                        "{store.latest_note.client_feedback}"
                                                                    </p>
                                                                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                                                                        {new Date(store.latest_note.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-muted-foreground/50 italic">
                                                                    Sin notas registradas
                                                                </span>
                                                            )}
                                                        </TableCell>

                                                        {/* COL 6: ACCIONES */}
                                                        <TableCell className="py-3.5 pr-5 text-right">
                                                            <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                                                                {store.owner_phone ? (
                                                                    <>
                                                                        {/* Botón Llamar con número */}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            asChild
                                                                            className="h-7 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1 px-2"
                                                                            title={`Llamar a ${store.owner_phone}`}
                                                                        >
                                                                            <a href={`tel:${store.owner_phone}`}>
                                                                                <Phone className="h-3 w-3 text-emerald-500" />
                                                                                <span className="font-mono">{store.owner_phone}</span>
                                                                            </a>
                                                                        </Button>

                                                                        {/* Botón WhatsApp Directo */}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            asChild
                                                                            className="h-7 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1 px-2"
                                                                            title="Enviar WhatsApp"
                                                                        >
                                                                            <a
                                                                                href={getWhatsAppUrl(store.owner_phone, store.owner_name, store.store_name) || '#'}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                            >
                                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                                                <span>WhatsApp</span>
                                                                            </a>
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setEditingPhoneStore({
                                                                                id: store.id,
                                                                                store_name: store.store_name || "Comercio",
                                                                                phone: ""
                                                                            });
                                                                            setPhoneInputValue("");
                                                                        }}
                                                                        className="h-7 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1 px-2"
                                                                        title="Registrar número para llamar o mandar WhatsApp"
                                                                    >
                                                                        <Phone className="h-3 w-3" />
                                                                        <span>+ Teléfono</span>
                                                                    </Button>
                                                                )}

                                                                {/* Botón Correo Bienvenida */}
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleSendWelcomeEmail(store)}
                                                                    disabled={isSendingWelcomeEmail === store.id}
                                                                    className="h-7 w-7 p-0 rounded-lg text-blue-600 hover:text-blue-500 hover:bg-blue-500/10"
                                                                    title="Enviar correo de bienvenida"
                                                                >
                                                                    {isSendingWelcomeEmail === store.id ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Mail className="h-3.5 w-3.5" />
                                                                    )}
                                                                </Button>

                                                                {/* Botón Registrar Nota */}
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setCrmStore(store);
                                                                        setNewNoteStatus(store.follow_up_status || 'called');
                                                                        setNotePhoneInput(store.owner_phone || '');
                                                                    }}
                                                                    className="h-7 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white gap-1 px-2.5 shadow-sm"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                    <span>Nota</span>
                                                                </Button>
                                                            </div>
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
                                    { name: 'Emprendedor', key: 'basic', color: 'bg-emerald-500', price: 895 },
                                    { name: 'Empresarial', key: 'pro', color: 'bg-blue-600', price: 1495 },
                                    { name: 'Corporativo', key: 'enterprise', color: 'bg-purple-600', price: 3500 }
                                ].map((plan) => {
                                    const count = stores?.filter((s: any) => s.is_active && normalizePlanId(s.plan_name) === plan.key).length || 0;
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
            {/* MODAL CRM: REGISTRO Y HISTORIAL DE NOTAS DE LLAMADA */}
            <Dialog open={!!crmStore} onOpenChange={(open) => !open && setCrmStore(null)}>
                <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border border-border text-foreground rounded-2xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2 text-left pb-3 border-b border-border/60">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-600 dark:text-purple-400">
                                    <PhoneCall className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-bold text-foreground">
                                        Seguimiento & Llamadas: {crmStore?.store_name}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground">
                                        Dueño: <strong className="text-foreground font-semibold">{crmStore?.owner_name || 'Usuario'}</strong>
                                        {crmStore?.owner_phone ? ` • Tel: ${crmStore.owner_phone}` : ''}
                                    </DialogDescription>
                                </div>
                            </div>

                            {crmStore?.owner_phone ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1 px-2.5"
                                        title={`Llamar a ${crmStore.owner_phone}`}
                                    >
                                        <a href={`tel:${crmStore.owner_phone}`}>
                                            <Phone className="h-3.5 w-3.5" />
                                            <span>Llamar</span>
                                        </a>
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 px-2"
                                    >
                                        <a 
                                            href={getWhatsAppUrl(crmStore.owner_phone, crmStore.owner_name, crmStore.store_name) || '#'}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Abrir WhatsApp con saludo personalizado"
                                        >
                                            <MessageCircle className="h-4 w-4" />
                                        </a>
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setEditingPhoneStore({
                                                id: crmStore.id,
                                                store_name: crmStore.store_name || "Comercio",
                                                phone: crmStore.owner_phone || ""
                                            });
                                            setPhoneInputValue(crmStore.owner_phone || "");
                                        }}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                        title="Editar teléfono"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingPhoneStore({
                                            id: crmStore.id,
                                            store_name: crmStore.store_name || "Comercio",
                                            phone: ""
                                        });
                                        setPhoneInputValue("");
                                    }}
                                    className="h-8 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1 px-2.5"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>+ Agregar Teléfono</span>
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="space-y-5 pt-3">
                        {/* Formulario para registrar nueva llamada / nota */}
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                <Plus className="h-3.5 w-3.5 text-purple-500" />
                                Registrar Nueva Nota de Llamada / Contacto
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-muted-foreground">Medio de Contacto</Label>
                                    <Select value={newNoteType} onValueChange={setNewNoteType}>
                                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="call">📞 Llamada telefónica</SelectItem>
                                            <SelectItem value="whatsapp">💬 Mensaje de WhatsApp</SelectItem>
                                            <SelectItem value="email">✉️ Correo electrónico</SelectItem>
                                            <SelectItem value="meeting">🤝 Reunión / Presencial</SelectItem>
                                            <SelectItem value="other">📋 Otro medio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-muted-foreground">Estado tras el contacto</Label>
                                    <Select value={newNoteStatus} onValueChange={setNewNoteStatus}>
                                        <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="called">🔵 Llamado / En seguimiento</SelectItem>
                                            <SelectItem value="interested">🟣 Interesado / En prueba</SelectItem>
                                            <SelectItem value="active">🟢 Convertido / Cliente Activo</SelectItem>
                                            <SelectItem value="unreachable">🟡 No contestó / Volver a llamar</SelectItem>
                                            <SelectItem value="not_interested">🔴 No interesado</SelectItem>
                                            <SelectItem value="new">⚪ Nuevo / Sin contactar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-muted-foreground">Teléfono del Cliente</Label>
                                    <Input
                                        value={notePhoneInput}
                                        onChange={(e) => setNotePhoneInput(e.target.value)}
                                        placeholder="Ej: 809-555-1234"
                                        className="h-9 text-xs rounded-xl bg-background font-mono font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-muted-foreground">
                                    ¿Qué dijo el cliente? (Detalle de la conversación)
                                </Label>
                                <textarea
                                    value={newNoteFeedback}
                                    onChange={(e) => setNewNoteFeedback(e.target.value)}
                                    placeholder="Ej: Hablé con Juan. Le gustó mucho la rapidez del POS en el celular, pero me preguntó cómo imprimir tickets vía Bluetooth. Le expliqué el proceso y acordamos llamarlo mañana..."
                                    className="w-full min-h-[90px] p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:border-purple-500 focus:outline-none resize-none leading-relaxed"
                                    maxLength={1500}
                                />
                                <span className="text-[10px] text-muted-foreground float-right">
                                    {newNoteFeedback.length} / 1500
                                </span>
                            </div>

                            <div className="flex justify-end pt-1">
                                <Button
                                    size="sm"
                                    disabled={addFollowUpNoteMutation.isPending || !newNoteFeedback.trim()}
                                    onClick={() => {
                                        if (crmStore) {
                                            if (notePhoneInput.trim() && notePhoneInput.trim() !== crmStore.owner_phone) {
                                                updateClientPhoneMutation.mutate({
                                                    storeId: crmStore.id,
                                                    phone: notePhoneInput.trim()
                                                });
                                            }
                                            addFollowUpNoteMutation.mutate({
                                                storeId: crmStore.id,
                                                contactType: newNoteType,
                                                clientFeedback: newNoteFeedback,
                                                status: newNoteStatus
                                            });
                                        }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs h-8 px-4 rounded-xl gap-1.5 shadow-sm"
                                >
                                    {addFollowUpNoteMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Check className="h-3.5 w-3.5" />
                                    )}
                                    <span>Guardar Nota de Llamada</span>
                                </Button>
                            </div>
                        </div>

                        {/* Historial de Notas Anteriores */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>Historial de Notas ({crmStore?.follow_up_notes?.length || 0})</span>
                                {crmStore?.created_at && (
                                    <span className="font-mono text-[10px] lowercase font-normal">
                                        registrado {new Date(crmStore.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </h4>

                            {!crmStore?.follow_up_notes || crmStore.follow_up_notes.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground border border-dashed border-border/70 rounded-xl p-4 text-xs">
                                    <PhoneCall className="h-6 w-6 mx-auto mb-1.5 opacity-30 text-purple-500" />
                                    <p className="font-semibold text-foreground">Sin llamadas registradas aún</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Escribe arriba lo que te comentó el cliente para mantener el historial.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                                    {crmStore.follow_up_notes.map((note: any) => {
                                        const noteStatus = getCrmStatusConfig(note.status);
                                        return (
                                            <div 
                                                key={note.id}
                                                className="p-3 rounded-xl border border-border/70 bg-card space-y-1.5 text-xs shadow-xs"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className={`text-[9px] font-bold ${noteStatus.color}`}>
                                                            {noteStatus.label}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground capitalize">
                                                            {note.contact_type === 'call' ? '📞 Llamada' : note.contact_type === 'whatsapp' ? '💬 WhatsApp' : note.contact_type === 'email' ? '✉️ Correo' : note.contact_type}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {new Date(note.created_at).toLocaleDateString('es-DO', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pl-2 border-l-2 border-purple-500/40">
                                                    {note.client_feedback}
                                                </p>
                                                {note.created_by && (
                                                    <span className="text-[10px] text-muted-foreground block text-right">
                                                        Por: {note.created_by}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL EDITAR / REGISTRAR TELÉFONO DE CONTACTO */}
            <Dialog open={!!editingPhoneStore} onOpenChange={(open) => !open && setEditingPhoneStore(null)}>
                <DialogContent className="max-w-md bg-card border border-border text-foreground rounded-2xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2 text-left pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                                <Phone className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Teléfono del Cliente
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    {editingPhoneStore?.store_name}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 pt-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Número de Teléfono / WhatsApp</Label>
                            <Input
                                value={phoneInputValue}
                                onChange={(e) => setPhoneInputValue(e.target.value)}
                                placeholder="Ej: 809-555-1234"
                                className="h-10 text-sm font-mono font-bold rounded-xl bg-background border-border/70 focus:border-emerald-500"
                                autoFocus
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Este número se usará para llamadas directas y mensajes de WhatsApp desde el Panel Maestro.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingPhoneStore(null)}
                                className="h-9 text-xs rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                disabled={updateClientPhoneMutation.isPending || !phoneInputValue.trim()}
                                onClick={() => {
                                    if (editingPhoneStore) {
                                        updateClientPhoneMutation.mutate({
                                            storeId: editingPhoneStore.id,
                                            phone: phoneInputValue.trim()
                                        });
                                    }
                                }}
                                className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl gap-1.5 px-4 shadow-sm"
                            >
                                {updateClientPhoneMutation.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Check className="h-3.5 w-3.5" />
                                )}
                                <span>Guardar Teléfono</span>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL VER REPORTES GENERADOS POR EL CLIENTE */}
            <Dialog open={!!reportsStore} onOpenChange={(open) => !open && setReportsStore(null)}>
                <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border border-border text-foreground rounded-2xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2 text-left pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-600 dark:text-blue-400">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Reportes Generados: {reportsStore?.store_name}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    {reportsStore?.monthly_reports_count || 0}/3 reportes este mes ({reportsStore?.total_reports_count || 0} en total histórico) para seguimiento
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 pt-3">
                        {!reportsStore?.support_reports || reportsStore.support_reports.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground border border-dashed border-border/70 rounded-xl p-6 text-xs">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                                <p className="font-bold text-foreground text-sm">Este cliente no ha generado reportes de soporte</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Cuando el cliente genere una solicitud desde su aplicación para contactarte, aparecerá aquí.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {reportsStore.support_reports.map((report: any) => {
                                    const isPending = report.status === 'pending';
                                    const isResolved = report.status === 'resolved';

                                    return (
                                        <div
                                            key={report.id}
                                            className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                                                isPending
                                                    ? 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                                                    : 'border-border/70 bg-card'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                                                        {report.report_type}
                                                    </span>
                                                    <h4 className="font-bold text-sm text-foreground">
                                                        {report.title}
                                                    </h4>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-bold shrink-0 ${
                                                        isResolved
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                                            : 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse'
                                                    }`}
                                                >
                                                    {isResolved ? 'Resuelto' : 'Pendiente de Contacto'}
                                                </Badge>
                                            </div>

                                            <div className="p-3 rounded-lg bg-background border border-border/60 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                                {report.message}
                                            </div>

                                            {/* Datos de contacto que puso el cliente */}
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                                                {report.contact_phone && (
                                                    <a 
                                                        href={`tel:${report.contact_phone}`}
                                                        className="flex items-center gap-1 hover:text-emerald-500 transition-colors"
                                                    >
                                                        <Phone className="h-3 w-3 text-emerald-500" />
                                                        <span>{report.contact_phone}</span>
                                                    </a>
                                                )}
                                                {report.contact_email && (
                                                    <a 
                                                        href={`mailto:${report.contact_email}`}
                                                        className="flex items-center gap-1 hover:text-blue-500 transition-colors"
                                                    >
                                                        <Mail className="h-3 w-3 text-blue-500" />
                                                        <span>{report.contact_email}</span>
                                                    </a>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(report.created_at).toLocaleDateString('es-DO', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>

                                            {/* Respuesta del admin o acción de marcar como resuelto */}
                                            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                                                <div className="flex-1">
                                                    {report.admin_response ? (
                                                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                            <strong>Respuesta dada:</strong> {report.admin_response}
                                                        </div>
                                                    ) : (
                                                        <Input
                                                            placeholder="Escribir respuesta para el cliente..."
                                                            className="h-8 text-xs rounded-lg"
                                                            value={adminResponseInput[report.id] || ''}
                                                            onChange={(e) => setAdminResponseInput(prev => ({
                                                                ...prev,
                                                                [report.id]: e.target.value
                                                            }))}
                                                        />
                                                    )}
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant={isResolved ? "outline" : "default"}
                                                    disabled={updateReportStatusMutation.isPending}
                                                    onClick={() => updateReportStatusMutation.mutate({
                                                        reportId: report.id,
                                                        status: isResolved ? 'pending' : 'resolved',
                                                        adminResponse: adminResponseInput[report.id] || report.admin_response
                                                    })}
                                                    className={`h-8 text-xs font-bold rounded-lg shrink-0 ${
                                                        isResolved
                                                            ? 'border-border'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    }`}
                                                >
                                                    {isResolved ? 'Reabrir Reporte' : 'Marcar Resuelto'}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SuperAdmin;

