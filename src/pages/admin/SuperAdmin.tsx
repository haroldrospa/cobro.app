
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
    Trash2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

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

const SuperAdmin = () => {
    const [selectedProof, setSelectedProof] = useState<string | null>(null);
    const [adminEmail, setAdminEmail] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending_payment">("active");

    const queryClient = useQueryClient();

    const { profile } = useUserProfile();

    // Auto-authenticate if the email is haroldrospa@gmail.com
    React.useEffect(() => {
        if (profile?.email?.toLowerCase() === 'haroldrospa@gmail.com') {
            setIsAuthenticated(true);
        }
    }, [profile]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Simple security layer: Profile must be admin AND correct PIN
        const isMaster = profile?.email?.toLowerCase() === 'haroldrospa@gmail.com';
        
        if (!isMaster && profile?.role !== 'admin' && profile?.role !== 'owner') {
            toast.error("No tienes permisos de Super-Administrador");
            return;
        }

        if (adminEmail === "2026" || adminEmail === "admin123" || isMaster) {
            setIsAuthenticated(true);
            toast.success("Panel financiero desbloqueado");
        } else {
            toast.error("Clave de acceso incorrecta");
        }
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

    // 5. Edición Manual de Suscripción
    const updateSubscriptionMutation = useMutation({
        mutationFn: async ({ companyId, planId, months }: { companyId: string, planId: string, months: number }) => {
            // Calculamos la fecha de fin: hoy + meses
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + months);

            const { error } = await supabase
                .from("company_subscriptions")
                .upsert({
                    company_id: companyId,
                    plan_id: planId,
                    status: 'active',
                    end_date: endDate.toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'company_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Suscripción actualizada manualmente");
            queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
        },
        onError: (err) => {
            toast.error("Error al actualizar: " + err.message);
        }
    });

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

    const getDaysRemaining = (dateString: string) => {
        if (!dateString) return 0;
        const days = differenceInDays(new Date(dateString), new Date());
        return days > 0 ? days : 0;
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
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" /> Acceso Superadmin
                        </CardTitle>
                        <CardDescription>
                            Introduce la clave maestra para gestionar pagos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                type="password"
                                placeholder="Clave de acceso..."
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                            <Button type="submit" className="w-full">
                                Entrar
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl animate-fade-in text-foreground">
            {/* Header Limpio y Profesional */}
            <div className="flex justify-between items-end mb-8 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Panel Financiero
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Visión general del rendimiento y suscripciones.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="h-9"
                >
                    <Loader2 className="h-3.5 w-3.5 mr-2" />
                    Actualizar
                </Button>
            </div>

            {/* KPI CARDS - Diseño Minimalista "Enterprise" */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                                                    <TableCell>
                                                        {hasPlan ? (
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-bold ${daysRemaining < 7 ? 'text-red-500' : 'text-green-600'}`}>
                                                                    {daysRemaining} días
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {new Date(store.plan_end_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            "-"
                                                        )}
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
        </div>
    );
};

export default SuperAdmin;
