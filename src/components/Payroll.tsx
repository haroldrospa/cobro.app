
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePayroll, Payroll as PayrollType, PayrollItem, DeductionDetail } from '@/hooks/usePayroll';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useUserStore } from '@/hooks/useUserStore';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Plus, Users, CheckCircle, Settings, Calculator, Percent, DollarSign, Trash2, Search, Printer, Mail, RefreshCcw, TrendingUp, TrendingDown, ArrowRight, Calendar, X, Save, Wallet, Gift, Receipt, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeductionsManager } from './DeductionsManager';
import { printPayrollReceipt } from '@/utils/printPayrollReceipt';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';

const getInitials = (name: string) => {
    if (!name) return 'EM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function PayrollContent() {
    const { payrolls, loadingPayrolls, createPayroll, deletePayroll, fetchPayrollItems, updatePayrollItem, finalizePayroll, syncPayrollCredits } = usePayroll();
    const { data: employees = [] } = useEmployees();
    const { settings, updateSettings } = useStoreSettings();
    const { data: userStore } = useUserStore();
    const { settings: companySettings } = useCompanySettings();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isNewOpen, setIsNewOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [selectedPayroll, setSelectedPayroll] = useState<PayrollType | null>(null);
    const [items, setItems] = useState<PayrollItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    // Filtro de la tabla de detalle: 'with_salary' (por defecto) oculta a quien
    // no tiene pago este periodo (base, bonos y neto todos en 0), que es ruido
    // visual cuando solo quieres revisar a quien sí se le va a pagar.
    const [salaryFilter, setSalaryFilter] = useState<'all' | 'with_salary' | 'zero_salary'>('with_salary');
    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
    const [justPaidPayroll, setJustPaidPayroll] = useState<{ payroll: PayrollType, items: PayrollItem[] } | null>(null);

    const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
    const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');

    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        if (frequency === 'monthly') {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            setPeriodStart(format(firstDay, 'yyyy-MM-dd'));
            setPeriodEnd(format(lastDay, 'yyyy-MM-dd'));
        } else if (frequency === 'biweekly') {
            const day = today.getDate();
            if (day <= 15) {
                setPeriodStart(format(new Date(year, month, 1), 'yyyy-MM-dd'));
                setPeriodEnd(format(new Date(year, month, 15), 'yyyy-MM-dd'));
            } else {
                const lastDay = new Date(year, month + 1, 0);
                setPeriodStart(format(new Date(year, month, 16), 'yyyy-MM-dd'));
                setPeriodEnd(format(lastDay, 'yyyy-MM-dd'));
            }
        } else if (frequency === 'weekly') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
            const monday = new Date(today.setDate(diff));
            const sunday = new Date(today.setDate(diff + 6));
            setPeriodStart(format(monday, 'yyyy-MM-dd'));
            setPeriodEnd(format(sunday, 'yyyy-MM-dd'));
        }
    }, [frequency, isNewOpen]);

    const showTSSGroup = localSettings.enable_afp && localSettings.enable_sfs;
    const showAFPOnly = localSettings.enable_afp && !localSettings.enable_sfs;
    const showSFSOnly = !localSettings.enable_afp && localSettings.enable_sfs;
    const showInfotep = localSettings.enable_infotep;

    const handleCreate = async () => {
        try {
            const newPayroll = await createPayroll({ start: new Date(periodStart), end: new Date(periodEnd), frequency });
            setIsNewOpen(false);
            if (newPayroll) {
                handleViewDetails(newPayroll);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleViewDetails = async (payroll: PayrollType) => {
        setSelectedPayroll(payroll);
        setLoadingItems(true);
        try {
            const data = await fetchPayrollItems(payroll.id);
            setItems(data);
            setSearchTerm(''); // Reset search when opening
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingItems(false);
        }
    };

    const saveSettings = async () => {
        try {
            await updateSettings(localSettings);
            toast({ title: "Guardado", description: "Configuración actualizada." });
            setIsSettingsOpen(false);
        } catch (e: any) {
            toast({ title: "Error", description: e.message || "No se pudo guardar.", variant: "destructive" });
        }
    };

    const handleSyncCredits = async () => {
        if (!selectedPayroll) return;
        setIsSaving(true);
        try {
            const updated = await syncPayrollCredits(selectedPayroll.id, items);
            setItems(updated);
            toast({ 
                title: "Créditos Sincronizados", 
                description: "Se han buscado deudas en el POS y actualizado los montos." 
            });
        } catch (e: any) {
            toast({ 
                title: "Error de Sincronización", 
                description: e.message || "Hubo un problema al buscar créditos.", 
                variant: "destructive" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        const hasSalary = (item.base_salary > 0) || ((item.bonuses || 0) > 0) || ((item.net_salary || 0) > 0);
        if (salaryFilter === 'with_salary') {
            return hasSalary;
        }
        if (salaryFilter === 'zero_salary') {
            return !hasSalary;
        }
        return true;
    });

    const countAll = items.length;
    const countWithSalary = items.filter(i => (i.base_salary > 0) || ((i.bonuses || 0) > 0) || ((i.net_salary || 0) > 0)).length;
    const countZeroSalary = items.filter(i => (i.base_salary === 0) && (!i.bonuses || i.bonuses === 0) && (!i.net_salary || i.net_salary === 0)).length;


    // --- PAYROLL DETAILS LOGIC ---

    const calculateEstimates = (emp: Employee) => {
        const base = emp.base_salary || 0;
        const details = emp.default_deductions_details || [];
        const dedScalar = (details.length === 0) ? (emp.default_deduction || 0) :
            details.reduce((s, d) => s + (Number(d.amount) || 0), 0);

        let tss = 0;
        if (localSettings.enable_afp) {
            if (localSettings.afp_type === 'fixed') tss += localSettings.afp_rate;
            else tss += base * (localSettings.afp_rate / 100);
        }
        if (localSettings.enable_sfs) {
            if (localSettings.sfs_type === 'fixed') tss += localSettings.sfs_rate;
            else tss += base * (localSettings.sfs_rate / 100);
        }

        let infotep = 0;
        if (localSettings.enable_infotep) {
            if (localSettings.infotep_type === 'fixed') infotep = localSettings.infotep_rate;
            else infotep += base * (localSettings.infotep_rate / 100);
        }
        tss = Math.round(tss * 100) / 100;
        infotep = Math.round(infotep * 100) / 100;
        const net = base - tss - infotep - dedScalar;
        return { tss, infotep, net, dedScalar };
    };

    const handleItemUpdate = (item: PayrollItem, field: keyof PayrollItem, value: any) => {
        // LOCAL UPDATE ONLY
        const updatedItems = items.map(i => {
            if (i.id !== item.id) return i;

            const newItem = { ...i, [field]: value };

            if (field === 'deductions_details') {
                const details = value as DeductionDetail[];
                newItem.deductions = details.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            }
            if (field === 'base_salary' || field === 'bonuses' || field === 'deductions' || field === 'deductions_details') {
                newItem.net_salary = newItem.base_salary - newItem.tss - newItem.infotep - newItem.deductions + (newItem.bonuses || 0);
            }

            return newItem;
        });
        setItems(updatedItems);
    };

    const savePayrollDetails = async () => {
        setIsSaving(true);
        try {
            await Promise.all(items.map(async (item) => {
                const payload: any = {
                    id: item.id,
                    base_salary: item.base_salary,
                    bonuses: item.bonuses,
                    deductions: item.deductions,
                    net_salary: item.net_salary,
                    deductions_details: item.deductions_details
                };
                await updatePayrollItem(payload);
            }));

            toast({ title: "Nómina Actualizada", description: "Todos los cambios han sido guardados." });

        } catch (e) {
            toast({ title: "Error", description: "Fallo al guardar algunos items.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-background/50 pb-20 animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto px-4 space-y-12">
                
                {/* --- PREMIUM HEADER --- */}
                <div className="flex flex-col items-center text-center pt-12 space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.2em] text-foreground leading-normal py-1">
                            Nomina
                        </h1>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-px w-8 bg-emerald-500/30" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500/70">
                                Gestion de Periodos de Pago
                            </p>
                            <div className="h-px w-8 bg-emerald-500/30" />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button
                            variant="outline" 
                            size="sm" 
                            onClick={() => setIsSettingsOpen(true)}
                            className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all rounded-full px-6"
                        >
                            <Settings className="mr-2 h-3.5 w-3.5" />
                            Ajustes
                        </Button>
                        <Button 
                            onClick={() => setIsNewOpen(true)} 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all rounded-full px-8 font-bold"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Ejecutar Nomina
                        </Button>
                    </div>
                </div>

                {/* --- KPI SUMMARY CARDS --- */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 p-6 rounded-3xl group hover:border-emerald-500/30 transition-all duration-500">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Users className="h-4 w-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Staff Activo</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{employees.length}</span>
                            <span className="text-xs text-zinc-500">Usuarios</span>
                        </div>
                    </div>

                    <div className="bg-zinc-950/40 backdrop-blur-md border border-zinc-800/50 p-6 rounded-3xl group hover:border-emerald-500/30 transition-all duration-500">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <DollarSign className="h-4 w-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nomina Estimada</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-[10px] font-bold text-emerald-500/60">$</span>
                            <span className="text-2xl lg:text-3xl font-black text-emerald-500 tracking-tighter">
                                {employees.reduce((sum, emp) => sum + calculateEstimates(emp).net, 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- PAYROLL PERIODS LIST --- */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Historial de Periodos</h3>
                        <div className="h-px flex-1 mx-4 bg-zinc-800/50" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {loadingPayrolls ? (
                            <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
                                <LoadingLogo text="" size="sm" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Sincronizando Archivos...</span>
                            </div>
                        ) : payrolls.length === 0 ? (
                            <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No hay periodos registrados aún</p>
                            </div>
                        ) : (
                            payrolls.map((payroll) => (
                                <div 
                                    key={payroll.id} 
                                    onClick={() => handleViewDetails(payroll)}
                                    className={cn(
                                        "group relative overflow-hidden bg-zinc-950/40 backdrop-blur-md border border-zinc-900 p-5 rounded-2xl transition-all duration-300 cursor-pointer hover:border-emerald-500/20",
                                        payroll.status === 'paid' ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-12 w-12 rounded-xl flex items-center justify-center transition-colors shadow-inner",
                                                payroll.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                            )}>
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black uppercase tracking-tight text-zinc-200">
                                                    {format(new Date(payroll.period_start), 'MMMM yyyy', { locale: es })}
                                                </h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-medium text-zinc-500">
                                                        {format(new Date(payroll.period_start), 'd MMM')} — {format(new Date(payroll.period_end), 'd MMM')}
                                                    </span>
                                                    <div className={cn(
                                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                                                        payroll.status === 'paid' 
                                                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                                                            : "bg-amber-500/5 border-amber-500/20 text-amber-500"
                                                    )}>
                                                        {payroll.status === 'paid' ? 'Completado' : 'Borrador'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="hidden sm:block text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Estatus Pago</p>
                                                <p className={cn(
                                                    "text-xs font-black",
                                                    payroll.status === 'paid' ? "text-emerald-500/80" : "text-zinc-500"
                                                )}>
                                                    {payroll.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                                </p>
                                            </div>
                                            
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("¿Estás seguro de eliminar esta nómina?")) deletePayroll(payroll.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            
                                            <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                    </div>
                                    
                                    {/* Glass reflection effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-zinc-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* RUN PAYROLL DIALOG */}
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Paso 1: Parámetros del Periodo</DialogTitle>
                        <DialogDescription>
                            Selecciona la frecuencia y el sistema calculará automáticamente las fechas y dividirá los salarios base configurados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="flex flex-col space-y-3">
                            <Label className="text-sm font-semibold">Frecuencia de Pago</Label>
                            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione Frecuencia" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensual (100% Salario)</SelectItem>
                                    <SelectItem value="biweekly">Quincenal (50% Salario)</SelectItem>
                                    <SelectItem value="weekly">Semanal (25% Salario)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-2">
                                <Label htmlFor="start" className="text-xs text-muted-foreground">Inicio del Periodo</Label>
                                <Input
                                    id="start"
                                    type="date"
                                    value={periodStart}
                                    onChange={(e) => setPeriodStart(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col space-y-2">
                                <Label htmlFor="end" className="text-xs text-muted-foreground">Fin del Periodo</Label>
                                <Input
                                    id="end"
                                    type="date"
                                    value={periodEnd}
                                    onChange={(e) => setPeriodEnd(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                            <p className="text-xs text-muted-foreground flex items-start gap-2">
                                <Calculator className="h-4 w-4 text-primary shrink-0" />
                                <span>Al continuar, el sistema generará los recibos en borrador para que puedas revisarlos y aplicar bonos adicionales antes de aprobar el pago.</span>
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} className="gap-2">
                            Generar y Revisar <CheckCircle className="h-4 w-4" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SETTINGS DIALOG */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configuración de Deducciones</DialogTitle>
                        <DialogDescription>Define montos fijos o porcentajes.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        {/* AFP */}
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_afp}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_afp: c }))}
                                    />
                                    <Label className="font-semibold">AFP (Pensiones)</Label>
                                </div>
                            </div>
                            {localSettings.enable_afp && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.afp_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, afp_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.afp_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, afp_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.afp_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, afp_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* SFS */}
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_sfs}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_sfs: c }))}
                                    />
                                    <Label className="font-semibold">SFS (Salud)</Label>
                                </div>
                            </div>
                            {localSettings.enable_sfs && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.sfs_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, sfs_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.sfs_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, sfs_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.sfs_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, sfs_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* INFOTEP */}
                        <div className="flex items-center justify-between space-x-2 border-t pt-4">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_infotep}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_infotep: c }))}
                                    />
                                    <Label className="font-semibold">INFOTEP</Label>
                                </div>
                            </div>
                            {localSettings.enable_infotep && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.infotep_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, infotep_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.infotep_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, infotep_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.infotep_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, infotep_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={saveSettings}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DETAILS DIALOG */}
            <Dialog open={!!selectedPayroll} onOpenChange={(o) => {
                if (!o && !isSaving) setSelectedPayroll(null);
            }}>
                <DialogContent centerOnMobile={false} className="w-full max-w-[96vw] xl:max-w-7xl h-[92vh] sm:h-[90vh] max-h-[100dvh] flex flex-col gap-0 p-0 bg-background border border-border shadow-[0_25px_80px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.9)] rounded-3xl overflow-hidden [&>button]:hidden">

                    {/* Top Header */}
                    <div className="p-4 sm:p-6 border-b border-border bg-background flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-muted border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner shrink-0">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground">
                                        {selectedPayroll && format(new Date(selectedPayroll.period_start), 'MMMM yyyy', { locale: es })}
                                    </DialogTitle>
                                    <Badge
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                                            selectedPayroll?.status === 'paid'
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                                : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                                        )}
                                    >
                                        {selectedPayroll?.status === 'paid' ? '● Pagado' : '● Borrador'}
                                    </Badge>
                                </div>
                                <DialogDescription className="sr-only">
                                    Detalles de la nómina generada para este periodo.
                                </DialogDescription>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                    <span>
                                        {selectedPayroll && `${format(new Date(selectedPayroll.period_start), 'd MMM')} — ${format(new Date(selectedPayroll.period_end), 'd MMM yyyy')}`}
                                    </span>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span className="font-semibold text-foreground">{items.length} {items.length === 1 ? 'Empleado' : 'Empleados'}</span>
                                </p>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedPayroll?.status !== 'paid' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSyncCredits}
                                        disabled={isSaving}
                                        className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-semibold h-9 px-3.5 transition-all"
                                    >
                                        <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", isSaving && "animate-spin")} />
                                        Sincronizar Créditos
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={savePayrollDetails}
                                        disabled={isSaving}
                                        className="bg-muted border-border text-foreground hover:bg-muted/70 rounded-xl text-xs font-semibold h-9 px-3.5 transition-all"
                                    >
                                        <Save className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                                    </Button>

                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-9 px-4 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all"
                                        onClick={async () => {
                                            await finalizePayroll(selectedPayroll!.id);
                                            // Comprobante impreso/descargado: excluye a quien no tuvo pago este
                                            // periodo (igual que la tabla en pantalla), sin importar si había
                                            // un texto de búsqueda activo en ese momento -- eso solo filtra la
                                            // vista, no debería recortar el recibo por accidente.
                                            const itemsForReceipt = items.filter(item =>
                                                (item.base_salary || 0) !== 0 || (item.bonuses || 0) !== 0 || (item.net_salary || 0) !== 0
                                            );
                                            setJustPaidPayroll({ payroll: selectedPayroll!, items: itemsForReceipt });
                                            setIsPrintDialogOpen(true);
                                            setSelectedPayroll(curr => curr ? { ...curr, status: 'paid' } : null);
                                        }}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Pagar Nómina
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-1"
                                onClick={() => setSelectedPayroll(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Metric Cards Banner */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 sm:px-6 bg-muted/20 border-b border-border/60">
                        <div className="bg-muted/40 border border-border rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Salario Base Total
                            </span>
                            <span className="text-base sm:text-lg font-bold font-mono text-foreground mt-1">
                                ${items.reduce((s, i) => s + (i.base_salary || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Gift className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Total Bonos
                            </span>
                            <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                                +${items.reduce((s, i) => s + (i.bonuses || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-muted/40 border border-border rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Retenciones & Deducciones
                            </span>
                            <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                                -${items.reduce((s, i) => s + (i.deductions || 0) + (i.tss || 0) + (i.infotep || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(16,185,129,0.08)]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Total Neto a Pagar
                            </span>
                            <span className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                                ${items.reduce((s, i) => s + (i.net_salary || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Content & Table */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-muted/5">
                        {/* Search & Filter Toolbar */}
                        <div className="p-3 sm:px-6 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 shrink-0">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar empleado por nombre..."
                                        className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-emerald-500/50 text-xs h-9 rounded-xl"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex items-center p-1 bg-muted/50 border border-border rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
                                    <button
                                        type="button"
                                        onClick={() => setSalaryFilter('all')}
                                        className={cn(
                                            "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                                            salaryFilter === 'all'
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <span>Todas</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                                            salaryFilter === 'all' ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
                                        )}>
                                            {countAll}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSalaryFilter('with_salary')}
                                        className={cn(
                                            "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                                            salaryFilter === 'with_salary'
                                                ? "bg-emerald-600 text-white shadow-sm"
                                                : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                                        )}
                                    >
                                        <span className="flex items-center gap-1">
                                            <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                salaryFilter === 'with_salary' ? "bg-white" : "bg-emerald-600 dark:bg-emerald-400"
                                            )} />
                                            Con Pago (&gt; $0)
                                        </span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                                            salaryFilter === 'with_salary' ? "bg-emerald-700 text-white" : "bg-muted/50 text-muted-foreground"
                                        )}>
                                            {countWithSalary}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSalaryFilter('zero_salary')}
                                        className={cn(
                                            "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap",
                                            salaryFilter === 'zero_salary'
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm"
                                                : "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                                        )}
                                    >
                                        <span>En Cero ($0)</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                                            salaryFilter === 'zero_salary' ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted/50 text-muted-foreground"
                                        )}>
                                            {countZeroSalary}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Mostrando <strong className="text-foreground">{filteredItems.length}</strong> de <strong className="text-foreground">{items.length}</strong> empleados
                            </span>
                        </div>

                        {/* Table Area */}
                        <div className="flex-1 overflow-auto p-0">
                            <Table className="w-full min-w-[750px] border-collapse">
                                <TableHeader className="bg-muted/60 sticky top-0 backdrop-blur-md z-10">
                                    <TableRow className="border-b border-border hover:bg-transparent">
                                        <TableHead className="w-[240px] pl-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Empleado</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sal. Base</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bonos (+)</TableHead>

                                        {(showTSSGroup || showAFPOnly || showSFSOnly) && (
                                            <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">TSS / Ley (-)</TableHead>
                                        )}

                                        {showInfotep && (
                                            <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Infotep (-)</TableHead>
                                        )}

                                        <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deducciones (-)</TableHead>
                                        <TableHead className="text-right font-bold w-[160px] pr-6 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Neto a Pagar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingItems ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <LoadingLogo text="" size="sm" />
                                                    <span className="text-xs text-muted-foreground">Cargando detalles de nómina...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                                                No se encontraron empleados registrados en este periodo
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item) => {
                                            const emp = employees.find(e => e.id === item.profile_id);
                                            const initials = getInitials(item.employee_name);
                                            return (
                                                <TableRow key={item.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                                                    <TableCell className="pl-6 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-muted border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0 shadow-sm">
                                                                {initials}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-sm text-foreground leading-snug">{item.employee_name}</span>
                                                                {emp?.cedula ? (
                                                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border w-fit mt-0.5">
                                                                        ID: {emp.cedula}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground italic mt-0.5">Sin cédula</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-right font-mono text-xs sm:text-sm text-foreground py-3.5">
                                                        ${item.base_salary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>

                                                    <TableCell className="text-center py-3.5">
                                                        <div className="flex justify-center items-center">
                                                            <div className="relative w-28">
                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-emerald-600 dark:text-emerald-500/70">+$</span>
                                                                <Input
                                                                    type="number"
                                                                    className="w-28 h-8 pl-7 pr-2 text-right bg-muted/40 border-border hover:border-emerald-500/40 focus:border-emerald-500/60 focus:bg-background transition-all font-mono text-xs text-emerald-700 dark:text-emerald-300 rounded-lg"
                                                                    value={item.bonuses}
                                                                    onChange={(e) => handleItemUpdate(item, 'bonuses', parseFloat(e.target.value) || 0)}
                                                                    readOnly={selectedPayroll?.status === 'paid'}
                                                                    disabled={selectedPayroll?.status === 'paid'}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {(showTSSGroup || showAFPOnly || showSFSOnly) && (
                                                        <TableCell className="text-center py-3.5">
                                                            <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-xs font-semibold">
                                                                -${item.tss.toFixed(2)}
                                                            </div>
                                                        </TableCell>
                                                    )}

                                                    {showInfotep && (
                                                        <TableCell className="text-center py-3.5">
                                                            <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-mono text-xs font-semibold">
                                                                -${item.infotep.toFixed(2)}
                                                            </div>
                                                        </TableCell>
                                                    )}

                                                    <TableCell className="text-center py-3.5">
                                                        <div className="flex justify-center">
                                                            <DeductionsManager
                                                                deductions={item.deductions_details?.length ? item.deductions_details : (item.deductions ? [{ amount: item.deductions, reason: "Deducciones" }] : [])}
                                                                onChange={(newDetails) => handleItemUpdate(item, 'deductions_details', newDetails)}
                                                                readOnly={selectedPayroll?.status === 'paid'}
                                                            />
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-right pr-6 py-3.5">
                                                        <div className="inline-flex items-center justify-end font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                                                            ${item.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Table Footer Totals Bar */}
                        <div className="p-3 sm:px-6 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Resumen General:</span>
                                <span>{filteredItems.length} empleados listados</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono">
                                <span className="text-muted-foreground">
                                    Base: <strong className="text-foreground">${filteredItems.reduce((s, i) => s + (i.base_salary || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-500/80">
                                    Bonos: <strong className="text-emerald-600 dark:text-emerald-400">+${filteredItems.reduce((s, i) => s + (i.bonuses || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </span>
                                <span className="text-rose-600 dark:text-rose-500/80">
                                    Deduc.: <strong className="text-rose-600 dark:text-rose-400">-${filteredItems.reduce((s, i) => s + (i.deductions || 0) + (i.tss || 0) + (i.infotep || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </span>
                                <div className="h-4 w-px bg-border" />
                                <span className="text-foreground font-sans font-semibold">
                                    Gran Total: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-sm">${filteredItems.reduce((s, i) => s + (i.net_salary || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>


            {/* PRINT OPTION DIALOG */}
            <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-6 w-6" />
                            ¡Nómina Pagada!
                        </DialogTitle>
                        <DialogDescription>
                            El pago se ha registrado correctamente. ¿Qué deseas hacer ahora?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button
                            className="w-full justify-start text-lg h-12"
                            variant="outline"
                            onClick={() => {
                                if (justPaidPayroll) {
                                    printPayrollReceipt(
                                        justPaidPayroll.payroll,
                                        justPaidPayroll.items,
                                        companySettings?.company_name || userStore?.store_name || 'Mi Negocio',
                                        companySettings?.logo_url || undefined
                                    );
                                }
                                setIsPrintDialogOpen(false);
                            }}
                        >
                            <Printer className="mr-3 h-5 w-5" /> Imprimir / Descargar Comprobante
                        </Button>
                        <Button
                            className="w-full justify-start text-lg h-12"
                            variant="outline"
                            onClick={() => {
                                toast({ title: "Enviado", description: "Comprobantes enviados por correo (Simulación)." });
                                setIsPrintDialogOpen(false);
                            }}
                        >
                            <Mail className="mr-3 h-5 w-5" /> Enviar por Correo
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsPrintDialogOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function Payroll() {
    return (
        <WithPlanAccess
            feature="canAccessPayroll"
            requiredPlan="pro"
            featureName="Nómina"
        >
            <PayrollContent />
        </WithPlanAccess>
    );
}
