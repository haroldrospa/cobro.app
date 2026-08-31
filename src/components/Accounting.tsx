import { useState, useRef, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, TrendingDown, TrendingUp, Building2, Calendar, FileText, Search, Filter, Trash2, Camera, Loader2, Check, CheckCheck, ChevronsUpDown, ChevronLeft, ChevronRight, AlertCircle, ShoppingCart, Receipt, Sparkles, PenTool, Eye, EyeOff, Settings2, Upload, X, Download, ZoomIn, ZoomOut, RotateCw, RefreshCw, Pencil, Wallet, ArrowUpRight, ArrowDownRight, Layers, CreditCard, Phone, Landmark, Copy } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSales } from '@/hooks/useSalesManagement';
import { useExpenses, Expense } from '@/hooks/useExpenses';
import { useFixedExpenses, FixedExpense } from '@/hooks/useFixedExpenses';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useSupplierDebts, SupplierDebt } from '@/hooks/useSupplierDebts';
import { useDailyClosings, DailyClosing } from '@/hooks/useDailyClosings';
import { useCashMovements, useCreateCashMovement, useDeleteCashMovement, CashMovement } from '@/hooks/useCashMovements';
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { lookupRnc } from '@/lib/rncLookup';
import { resolveActiveAiApiKey, scanInvoiceExpense, cleanAiKey, testGroqApiKey } from '@/utils/aiService';


const CATEGORIES = [
    'Inventario',
    'Servicios Públicos',
    'Alquiler',
    'Nómina',
    'Mantenimiento',
    'Marketing',
    'Impuestos',
    'Otros'
];

// Categorías que clasifican como Reinversión (compra de mercancía)
const REINVESTMENT_CATEGORIES = ['Inventario'];
const isReinvestment = (category: string) => REINVESTMENT_CATEGORIES.includes(category);

type Supplier = {
    id: string;
    name: string;
    rnc?: string | null;
    contact?: string | null;
};

function AccountingContent() {

    // Batch Scanning Types & State
    type QueueItem = {
        id: string;
        file: File;
        status: 'pending' | 'scanning' | 'success' | 'error' | 'saved';
        extractedData?: any;
        imageUrl?: string;
        error?: string;
        statusMessage?: string;
    };

    const [scanQueue, setScanQueue] = useState<QueueItem[]>([]);
    const [reviewIndex, setReviewIndex] = useState(0);
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(() => {
        const savedDate = sessionStorage.getItem('accounting_view_date');
        return savedDate ? new Date(savedDate) : new Date();
    });

    useEffect(() => {
        if (currentDate) {
            sessionStorage.setItem('accounting_view_date', currentDate.toISOString());
        }
    }, [currentDate]);

    const dateFrom = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const dateTo = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data: sales = [], isLoading: loadingSales } = useSales({ dateFrom, dateTo });
    const { expenses, createExpense, updateExpense, deleteExpense, isLoading: loadingExpenses, isCreating, isUpdating: isUpdatingExpense } = useExpenses();
    const { suppliers, createSupplier, updateSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
    const { settings: storeSettings, updateSettings } = useStoreSettings();
    const { data: dailyClosings = [], isLoading: loadingClosings } = useDailyClosings();
    const { data: cashMovements = [], isLoading: loadingMovements } = useCashMovements();
    const { mutateAsync: createCashMovement, isPending: isCreatingMovement } = useCreateCashMovement();
    const { mutateAsync: deleteCashMovement, isPending: isDeletingMovement } = useDeleteCashMovement();

    const [selectedDayDetail, setSelectedDayDetail] = useState<any>(null);
    const [isDeductOpen, setIsDeductOpen] = useState(false);
    const [deductForm, setDeductForm] = useState({
        amount: '',
        reason: '',
        date: format(new Date(), 'yyyy-MM-dd')
    });

    const handleRegisterDeduction = async () => {
        if (!deductForm.amount || !deductForm.reason.trim()) {
            toast({
                title: "Campos incompletos",
                description: "Por favor introduce el monto y la razón del descuento.",
                variant: "destructive"
            });
            return;
        }

        const amountNum = parseFloat(deductForm.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast({
                title: "Monto inválido",
                description: "El monto a descontar debe ser mayor a 0.",
                variant: "destructive"
            });
            return;
        }

        try {
            const timestamp = deductForm.date
                ? new Date(`${deductForm.date}T12:00:00`).toISOString()
                : new Date().toISOString();

            await createCashMovement({
                type: 'withdrawal',
                amount: amountNum,
                reason: deductForm.reason.trim(),
                created_at: timestamp
            });

            toast({
                title: "Descuento Aplicado",
                description: `Se descontaron $${amountNum.toLocaleString()} del cuadre exitosamente.`
            });

            setIsDeductOpen(false);
            setDeductForm({ amount: '', reason: '', date: format(currentDate || new Date(), 'yyyy-MM-dd') });
        } catch (err: any) {
            console.error("Error al descontar del cuadre:", err);
            toast({
                title: "Error al aplicar descuento",
                description: err.message || "No se pudo realizar el descuento.",
                variant: "destructive"
            });
        }
    };

    const handleDeleteDeduction = async (movementId: string) => {
        if (confirm("¿Estás seguro de eliminar este descuento/retiro del cuadre?")) {
            try {
                await deleteCashMovement(movementId);
                toast({ title: "Descuento Eliminado", description: "El registro ha sido eliminado." });
            } catch (err: any) {
                console.error("Error al eliminar descuento:", err);
            }
        }
    };

    const handleDeductInvoiceFromCuadre = (targetDate: Date, cuadreLabel?: string) => {
        setNewExpense({
            description: cuadreLabel ? `Factura descontada de cuadre (${cuadreLabel})` : 'Factura descontada del cuadre',
            amount: '',
            category: 'Inventario',
            supplier_name: '',
            invoice_number: '',
            date: targetDate
        });
        setScanQueue([]);
        setReviewIndex(0);
        setIsScanning(false);
        setExpenseType('reinversion');
        setIsAddExpenseOpen(true);
    };

    const { 
        fixedExpenses, 
        createFixedExpense, 
        updateFixedExpense, 
        deleteFixedExpense, 
        isLoading: loadingFixedExpenses 
    } = useFixedExpenses();

    const [isAddFixedOpen, setIsAddFixedOpen] = useState(false);
    const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
    const [fixedForm, setFixedForm] = useState({
        description: '',
        amount: '',
        category: 'Alquiler',
        due_day: '5'
    });

    // Deudas con Proveedores State & Hook
    const {
        supplierDebts,
        createSupplierDebt,
        paySupplierDebt,
        deleteSupplierDebt,
        isLoading: loadingSupplierDebts,
        isCreating: isCreatingSupplierDebt,
        isPaying: isPayingSupplierDebt,
        isDeleting: isDeletingSupplierDebt
    } = useSupplierDebts();

    const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
    const [selectedSupplierForDebt, setSelectedSupplierForDebt] = useState<Supplier | null>(null);
    const [debtForm, setDebtForm] = useState({
        amount: '',
        description: '',
        category: 'Inventario',
        due_date: ''
    });

    const [isViewDebtsOpen, setIsViewDebtsOpen] = useState(false);
    const [selectedSupplierForView, setSelectedSupplierForView] = useState<Supplier | null>(null);

    const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
    const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<SupplierDebt | null>(null);
    const [payDebtForm, setPayDebtForm] = useState({
        amountToPay: '',
        category: 'Inventario',
        description: ''
    });

    const handleRegisterDebt = async () => {
        if (!selectedSupplierForDebt) return;
        if (!debtForm.amount || !debtForm.description.trim()) {
            toast({
                title: "Campos incompletos",
                description: "Por favor introduce el monto y la descripción.",
                variant: "destructive"
            });
            return;
        }

        const amountNum = parseFloat(debtForm.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast({
                title: "Monto inválido",
                description: "El monto de la deuda debe ser mayor a 0.",
                variant: "destructive"
            });
            return;
        }

        try {
            await createSupplierDebt({
                supplier_id: selectedSupplierForDebt.id,
                amount: amountNum,
                description: debtForm.description.trim(),
                category: debtForm.category,
                due_date: debtForm.due_date || null
            });
            setIsAddDebtOpen(false);
            setDebtForm({ amount: '', description: '', category: 'Inventario', due_date: '' });
        } catch (err) {
            console.error("Error al registrar deuda:", err);
        }
    };

    const handlePayDebt = async () => {
        if (!selectedDebtForPayment) return;
        if (!payDebtForm.amountToPay) {
            toast({
                title: "Campo incompleto",
                description: "Introduce el monto a abonar/pagar.",
                variant: "destructive"
            });
            return;
        }

        const payAmountNum = parseFloat(payDebtForm.amountToPay);
        if (isNaN(payAmountNum) || payAmountNum <= 0) {
            toast({
                title: "Monto inválido",
                description: "El monto a pagar debe ser mayor a 0.",
                variant: "destructive"
            });
            return;
        }

        const remainingDebt = Number(selectedDebtForPayment.amount) - Number(selectedDebtForPayment.amount_paid);
        if (payAmountNum > remainingDebt + 0.01) {
            toast({
                title: "Monto excedido",
                description: `El monto a pagar no puede superar los pagos pendientes ($${remainingDebt.toLocaleString()}).`,
                variant: "destructive"
            });
            return;
        }

        try {
            await paySupplierDebt({
                debtId: selectedDebtForPayment.id,
                amountToPay: payAmountNum,
                category: payDebtForm.category,
                description: payDebtForm.description.trim() || undefined
            });
            setIsPayDebtOpen(false);
            setSelectedDebtForPayment(null);
            setPayDebtForm({ amountToPay: '', category: 'Inventario', description: '' });
        } catch (err) {
            console.error("Error al realizar pago de deuda:", err);
        }
    };

    const handleDeleteDebt = async (id: string, description: string) => {
        if (confirm(`¿Estás seguro de eliminar el registro de deuda "${description}"?`)) {
            try {
                await deleteSupplierDebt(id);
            } catch (err) {
                console.error("Error al eliminar deuda:", err);
            }
        }
    };

    const getSupplierOutstandingDebt = (supplierId: string) => {
        const supplierDebtsList = supplierDebts.filter(d => d.supplier_id === supplierId && d.status !== 'paid');
        return supplierDebtsList.reduce((sum, d) => sum + (Number(d.amount) - Number(d.amount_paid)), 0);
    };


    const handleSaveFixedExpense = async () => {
        if (!fixedForm.description.trim() || !fixedForm.amount || !fixedForm.due_day) {
            toast({
                title: "Campos incompletos",
                description: "Por favor llena todos los campos obligatorios.",
                variant: "destructive"
            });
            return;
        }

        const dueDayNum = parseInt(fixedForm.due_day, 10);
        if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
            toast({
                title: "Día inválido",
                description: "El día de vencimiento debe estar entre 1 y 31.",
                variant: "destructive"
            });
            return;
        }

        const amountNum = parseFloat(fixedForm.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast({
                title: "Monto inválido",
                description: "El monto debe ser mayor a 0.",
                variant: "destructive"
            });
            return;
        }

        try {
            if (editingFixed) {
                await updateFixedExpense({
                    ...editingFixed,
                    description: fixedForm.description.trim(),
                    amount: amountNum,
                    category: fixedForm.category,
                    due_day: dueDayNum
                });
            } else {
                await createFixedExpense({
                    description: fixedForm.description.trim(),
                    amount: amountNum,
                    category: fixedForm.category,
                    due_day: dueDayNum
                });
            }
            setIsAddFixedOpen(false);
            setEditingFixed(null);
            setFixedForm({ description: '', amount: '', category: 'Alquiler', due_day: '5' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAsPaid = async (fixed: FixedExpense) => {
        if (isCreating) return;

        const today = new Date();
        let expenseDate = today;

        if (currentDate.getMonth() !== today.getMonth() || currentDate.getFullYear() !== today.getFullYear()) {
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const actualDay = Math.min(fixed.due_day, daysInMonth);
            expenseDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), actualDay, 12, 0, 0);
        }

        try {
            await createExpense({
                date: expenseDate,
                description: `Gasto Fijo: ${fixed.description}`,
                amount: fixed.amount,
                category: fixed.category,
                fixed_expense_id: fixed.id,
                supplier_id: null,
                invoice_number: null,
                image_url: null,
                created_at: expenseDate.toISOString()
            });

            toast({
                title: "Gasto pagado",
                description: `Se registró el pago de "${fixed.description}" en Contabilidad.`,
                className: "bg-emerald-50 text-emerald-900 border-emerald-200"
            });
        } catch (err) {
            console.error("Error al registrar pago de gasto fijo:", err);
        }
    };

    const handleDeleteFixed = async (id: string, description: string) => {
        if (confirm(`¿Estás seguro de eliminar el gasto fijo "${description}"?`)) {
            try {
                await deleteFixedExpense(id);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleDeleteSupplier = async (id: string, name: string) => {
        if (confirm(`¿Estás seguro de eliminar el proveedor "${name}"?`)) {
            try {
                await deleteSupplier(id);
                if (newExpense.supplier_name === name) {
                    setNewExpense(prev => ({ ...prev, supplier_name: '' }));
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const [activeTab, setActiveTab] = useState('overview');
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    const [expenseEntryMode, setExpenseEntryMode] = useState<string>('manual');

    // States for interactive zoomable receipt preview
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [previewImageScale, setPreviewImageScale] = useState(1);
    const [previewImageRotation, setPreviewImageRotation] = useState(0);
    const [previewImagePosition, setPreviewImagePosition] = useState({ x: 0, y: 0 });
    const [isDraggingPreview, setIsDraggingPreview] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Zoom & Pan helper handlers
    const handleZoomIn = () => setPreviewImageScale(s => Math.min(s + 0.25, 4));
    const handleZoomOut = () => setPreviewImageScale(s => Math.max(s - 0.25, 0.5));
    const handleResetZoom = () => {
        setPreviewImageScale(1);
        setPreviewImageRotation(0);
        setPreviewImagePosition({ x: 0, y: 0 });
    };
    const handleRotate = () => setPreviewImageRotation(r => (r + 90) % 360);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingPreview(true);
        setDragStart({ x: e.clientX - previewImagePosition.x, y: e.clientY - previewImagePosition.y });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingPreview) return;
        setPreviewImagePosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDraggingPreview(false);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const zoomFactor = e.deltaY < 0 ? 0.1 : -0.1;
        setPreviewImageScale(s => Math.min(Math.max(s + zoomFactor, 0.5), 4));
    };

    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isEditingKey, setIsEditingKey] = useState(false);
    const [isTestingApiKey, setIsTestingApiKey] = useState(false);

    const activeAiKey = resolveActiveAiApiKey(storeSettings);
    const isKeyConfigured = !!activeAiKey;

    // Form State
    const [newExpense, setNewExpense] = useState<{
        date: Date;
        description: string;
        amount: string | number;
        category: string;
        supplier_name: string;
        invoice_number: string;
        image_url: string | null;
    }>({
        date: new Date(),
        description: '',
        amount: '',
        category: 'Inventario',
        supplier_name: '',
        invoice_number: '',
        image_url: null
    });

    const manualFileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingManualImage, setIsUploadingManualImage] = useState(false);
    const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<Expense | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isEditingExpenseDetails, setIsEditingExpenseDetails] = useState(false);
    const [editExpenseForm, setEditExpenseForm] = useState<{
        description: string;
        amount: string;
        category: string;
        supplier_name: string;
        supplier_id: string | null;
        date: string;
        invoice_number: string;
        image_url: string | null;
    }>({
        description: '',
        amount: '',
        category: 'Otros',
        supplier_name: '',
        supplier_id: null,
        date: '',
        invoice_number: '',
        image_url: null,
    });
    const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ payment_method: 'transfer' });
    const [isLookingUpSupplierRnc, setIsLookingUpSupplierRnc] = useState(false);

    const handleLookupSupplierRnc = async () => {
        if (!newSupplier.rnc?.trim()) return;
        setIsLookingUpSupplierRnc(true);
        try {
            const result = await lookupRnc(newSupplier.rnc);
            if (result.success && result.name) {
                setNewSupplier(prev => ({ ...prev, name: result.name! }));
                toast({
                    title: "Proveedor encontrado",
                    description: `Nombre: ${result.name}`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Consulta fallida",
                    description: result.error || "No se encontró un proveedor con este RNC/Cédula.",
                });
            }
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error de conexión al consultar.",
            });
        } finally {
            setIsLookingUpSupplierRnc(false);
        }
    };
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierDebtFilter, setSupplierDebtFilter] = useState<'all' | 'with_debt' | 'no_debt'>('all');
    // Expense type: 'reinversion' = Inventario, 'operativo' = all others
    const [expenseType, setExpenseType] = useState<'reinversion' | 'operativo'>('reinversion');

    // Search & Filter States for Expenses
    const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
    const [expenseTypeFilter, setExpenseTypeFilter] = useState<'all' | 'reinversion' | 'operativo'>('all');
    const [expenseHasReceiptFilter, setExpenseHasReceiptFilter] = useState<'all' | 'with_receipt' | 'without_receipt'>('all');
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

    // Search & Filter States for other tabs
    const [dailySummarySearch, setDailySummarySearch] = useState('');
    const [fixedExpenseSearch, setFixedExpenseSearch] = useState('');

    const operativeCategories = CATEGORIES.filter(c => !REINVESTMENT_CATEGORIES.includes(c));
    const availableCategories = expenseType === 'reinversion' ? REINVESTMENT_CATEGORIES : operativeCategories;

    const handleExpenseTypeChange = (type: 'reinversion' | 'operativo') => {
        setExpenseType(type);
        const defaultCat = type === 'reinversion' ? 'Inventario' : 'Servicios Públicos';
        setNewExpense(prev => ({ ...prev, category: defaultCat }));
    };

    // Month Navigation
    const nextMonth = () => {
        const next = new Date(currentDate);
        next.setMonth(next.getMonth() + 1);
        setCurrentDate(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentDate);
        prev.setMonth(prev.getMonth() - 1);
        setCurrentDate(prev);
    };

    // Filter Data by Month
    const filteredSales = (sales || []).filter(sale => {
        if (!sale || !sale.created_at) return false;
        const d = new Date(sale.created_at);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    const filteredExpenses = (expenses || []).filter(expense => {
        if (!expense || !expense.created_at) return false;
        // Filter by Registration Date (Audit Date) as requested, not the Transaction Date
        const d = new Date(expense.created_at);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    // Filtered Expenses by Search, Category, Type, and Receipt Attachment
    const searchedAndFilteredExpenses = useMemo(() => {
        return (filteredExpenses || []).filter(expense => {
            if (!expense) return false;
            
            // Text Search
            if (expenseSearchQuery.trim()) {
                const query = expenseSearchQuery.toLowerCase().trim();
                const matchDesc = expense.description?.toLowerCase().includes(query);
                const matchSupplier = expense.supplier_name?.toLowerCase().includes(query);
                const matchCat = expense.category?.toLowerCase().includes(query);
                const matchInvoice = expense.invoice_number?.toLowerCase().includes(query);
                const matchAmount = expense.amount?.toString().includes(query);
                
                if (!matchDesc && !matchSupplier && !matchCat && !matchInvoice && !matchAmount) {
                    return false;
                }
            }

            // Category Filter
            if (expenseCategoryFilter !== 'all' && expense.category !== expenseCategoryFilter) {
                return false;
            }

            // Type Filter
            if (expenseTypeFilter === 'reinversion' && !isReinvestment(expense.category)) {
                return false;
            }
            if (expenseTypeFilter === 'operativo' && isReinvestment(expense.category)) {
                return false;
            }

            // Receipt Attachment Filter
            if (expenseHasReceiptFilter === 'with_receipt' && !expense.image_url) {
                return false;
            }
            if (expenseHasReceiptFilter === 'without_receipt' && expense.image_url) {
                return false;
            }

            return true;
        });
    }, [filteredExpenses, expenseSearchQuery, expenseCategoryFilter, expenseTypeFilter, expenseHasReceiptFilter]);

    const hasActiveExpenseFilters = expenseSearchQuery.trim() !== '' || expenseCategoryFilter !== 'all' || expenseTypeFilter !== 'all' || expenseHasReceiptFilter !== 'all';

    const clearExpenseFilters = () => {
        setExpenseSearchQuery('');
        setExpenseCategoryFilter('all');
        setExpenseTypeFilter('all');
        setExpenseHasReceiptFilter('all');
    };

    // Calculations
    let collectedSales = 0;
    let pendingCreditSales = 0;

    filteredSales.forEach(sale => {
        if (sale.status === 'cancelled') return;

        // Si ya está pagado por completo, sumar todo al ingreso cobrado
        if (sale.payment_status === 'paid' || 
           (sale.payment_method !== 'credit' && sale.payment_method !== 'pending')) {
            collectedSales += (sale.total || 0);
        } else {
            // Si es a crédito o pendiente:
            // 1. Sumamos lo que ya han abonado (pagos parciales) a los ingresos cobrados
            collectedSales += (sale.amount_paid || 0);
            // 2. Lo que falta por pagar va a créditos pendientes
            pendingCreditSales += ((sale.total || 0) - (sale.amount_paid || 0));
        }
    });

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const reinvestmentExpenses = filteredExpenses
        .filter(e => isReinvestment(e.category))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    const operationalExpenses = filteredExpenses
        .filter(e => !isReinvestment(e.category))
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Net income uses only collected sales minus total expenses
    const netIncome = collectedSales - totalExpenses;

    // Grouping Cuadres (Cierres de Caja) & Egresos (Gastos) by Day
    const dailyDataMap = useMemo(() => {
        const map: {
            [dateKey: string]: {
                dateKey: string;
                dateObj: Date;
                closings: DailyClosing[];
                expenses: Expense[];
                withdrawals: CashMovement[];
                totalSalesCash: number;
                totalSalesCard: number;
                totalSalesTransfer: number;
                totalSalesOther: number;
                totalGrossClosingIncome: number;
                totalWithdrawals: number;
                totalClosingIncome: number;
                totalExpectedCash: number;
                totalActualCash: number;
                totalDifference: number;
                totalExpenses: number;
                reinvestmentExpenses: number;
                operationalExpenses: number;
                netBalance: number;
            };
        } = {};

        // 1. Process Closings for current month (grouped by shift start/opening date)
        (dailyClosings || []).forEach(closing => {
            const sessionDateStr = closing.created_at || closing.closing_time;
            if (!sessionDateStr) return;
            const dateObj = new Date(sessionDateStr);
            if (dateObj.getMonth() !== currentDate.getMonth() || dateObj.getFullYear() !== currentDate.getFullYear()) return;

            const dateKey = format(dateObj, 'yyyy-MM-dd');
            if (!map[dateKey]) {
                map[dateKey] = {
                    dateKey,
                    dateObj,
                    closings: [],
                    expenses: [],
                    withdrawals: [],
                    totalSalesCash: 0,
                    totalSalesCard: 0,
                    totalSalesTransfer: 0,
                    totalSalesOther: 0,
                    totalGrossClosingIncome: 0,
                    totalWithdrawals: 0,
                    totalClosingIncome: 0,
                    totalExpectedCash: 0,
                    totalActualCash: 0,
                    totalDifference: 0,
                    totalExpenses: 0,
                    reinvestmentExpenses: 0,
                    operationalExpenses: 0,
                    netBalance: 0,
                };
            }

            const closingIncome = (closing.total_sales_cash || 0) + (closing.total_sales_card || 0) + (closing.total_sales_transfer || 0) + (closing.total_sales_other || 0);
            
            // Real physical cash in this shift (including cash sales + deposits - withdrawals during shift, or actual counted cash):
            const cashInSession = (typeof closing.actual_cash === 'number' && closing.actual_cash > 0) 
                ? closing.actual_cash 
                : (typeof closing.expected_cash === 'number' && closing.expected_cash > 0
                    ? closing.expected_cash
                    : ((closing.total_sales_cash || 0) + (closing.total_cash_in || 0) - (closing.total_cash_out || 0)));

            map[dateKey].closings.push(closing);
            map[dateKey].totalSalesCash += cashInSession;
            map[dateKey].totalSalesCard += (closing.total_sales_card || 0);
            map[dateKey].totalSalesTransfer += (closing.total_sales_transfer || 0);
            map[dateKey].totalSalesOther += (closing.total_sales_other || 0);
            map[dateKey].totalGrossClosingIncome += closingIncome;
            map[dateKey].totalExpectedCash += (closing.expected_cash || 0);
            map[dateKey].totalActualCash += (closing.actual_cash || 0);
            map[dateKey].totalDifference += (closing.difference || 0);
        });

        // 2. Process Cash Withdrawals / Descuentos for current month
        (cashMovements || []).forEach(mov => {
            if (!mov.created_at || mov.type !== 'withdrawal') return;
            const dateObj = new Date(mov.created_at);
            if (dateObj.getMonth() !== currentDate.getMonth() || dateObj.getFullYear() !== currentDate.getFullYear()) return;

            const dateKey = format(dateObj, 'yyyy-MM-dd');
            if (!map[dateKey]) {
                map[dateKey] = {
                    dateKey,
                    dateObj,
                    closings: [],
                    expenses: [],
                    withdrawals: [],
                    totalSalesCash: 0,
                    totalSalesCard: 0,
                    totalSalesTransfer: 0,
                    totalSalesOther: 0,
                    totalGrossClosingIncome: 0,
                    totalWithdrawals: 0,
                    totalClosingIncome: 0,
                    totalExpectedCash: 0,
                    totalActualCash: 0,
                    totalDifference: 0,
                    totalExpenses: 0,
                    reinvestmentExpenses: 0,
                    operationalExpenses: 0,
                    netBalance: 0,
                };
            }

            map[dateKey].withdrawals.push(mov);
            map[dateKey].totalWithdrawals += (mov.amount || 0);
        });

        // 3. Process Expenses (Facturas / Gastos) for current month
        (filteredExpenses || []).forEach(expense => {
            const expDate = expense.date || expense.created_at;
            if (!expDate) return;
            const dateObj = new Date(expDate);
            if (dateObj.getMonth() !== currentDate.getMonth() || dateObj.getFullYear() !== currentDate.getFullYear()) return;

            const dateKey = format(dateObj, 'yyyy-MM-dd');
            if (!map[dateKey]) {
                map[dateKey] = {
                    dateKey,
                    dateObj,
                    closings: [],
                    expenses: [],
                    withdrawals: [],
                    totalSalesCash: 0,
                    totalSalesCard: 0,
                    totalSalesTransfer: 0,
                    totalSalesOther: 0,
                    totalGrossClosingIncome: 0,
                    totalWithdrawals: 0,
                    totalClosingIncome: 0,
                    totalExpectedCash: 0,
                    totalActualCash: 0,
                    totalDifference: 0,
                    totalExpenses: 0,
                    reinvestmentExpenses: 0,
                    operationalExpenses: 0,
                    netBalance: 0,
                };
            }

            const amount = expense.amount || 0;
            map[dateKey].expenses.push(expense);
            map[dateKey].totalExpenses += amount;
            
            // IMPORTANT: Include expenses in totalWithdrawals so facturas/gastos are deducted from daily cuadre!
            map[dateKey].totalWithdrawals += amount;

            if (isReinvestment(expense.category)) {
                map[dateKey].reinvestmentExpenses += amount;
            } else {
                map[dateKey].operationalExpenses += amount;
            }
        });

        // 4. Compute net closing income & net balance for each day
        Object.values(map).forEach(day => {
            day.totalClosingIncome = day.totalGrossClosingIncome - day.totalWithdrawals;
            day.netBalance = day.totalClosingIncome - day.totalExpenses;
        });

        // Filter out days that have no closed cash sessions AND no cash withdrawals/deductions/expenses
        return Object.values(map)
            .filter(day => day.closings.length > 0 || day.withdrawals.length > 0 || day.expenses.length > 0)
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }, [dailyClosings, cashMovements, filteredExpenses, currentDate]);

    // Filtered daily data by search query
    const searchedDailyDataMap = useMemo(() => {
        if (!dailySummarySearch.trim()) return dailyDataMap;
        const q = dailySummarySearch.toLowerCase().trim();
        return dailyDataMap.filter(day => {
            const dateFormatted = format(day.dateObj, "EEEE, d 'de' MMMM", { locale: es }).toLowerCase();
            const dateKey = day.dateKey.toLowerCase();
            const totalCash = (day.totalSalesCash || day.totalGrossClosingIncome || 0).toString();
            return dateFormatted.includes(q) || dateKey.includes(q) || totalCash.includes(q);
        });
    }, [dailyDataMap, dailySummarySearch]);

    // Filtered fixed expenses by search query
    const searchedFixedExpenses = useMemo(() => {
        if (!fixedExpenseSearch.trim()) return fixedExpenses;
        const q = fixedExpenseSearch.toLowerCase().trim();
        return fixedExpenses.filter(f => 
            f.description.toLowerCase().includes(q) || 
            f.category.toLowerCase().includes(q) || 
            f.amount.toString().includes(q)
        );
    }, [fixedExpenses, fixedExpenseSearch]);



    // Load queue item data into form
    useEffect(() => {
        if (scanQueue.length > 0 && scanQueue[reviewIndex]) {
            const item = scanQueue[reviewIndex];
            const previewUrl = item.imageUrl || item.extractedData?.image_url || (item.file ? URL.createObjectURL(item.file) : null);
            if ((item.status === 'success' || item.status === 'saved') && item.extractedData) {
                const data = item.extractedData;
                setNewExpense(prev => ({
                    ...prev,
                    date: data.date ? new Date(data.date) : new Date(),
                    description: data.description || `Gasto en ${data.supplier_name || 'Desconocido'}`,
                    amount: typeof data.amount === 'number' ? data.amount : (parseFloat(data.amount) || 0),
                    supplier_name: data.supplier_name || '',
                    invoice_number: data.invoice_number || '',
                    category: data.category || 'Otros',
                    image_url: data.image_url || previewUrl || null
                }));
            } else if (item.status === 'error') {
                toast({ title: "Error de escaneo", description: item.error || "No se pudo leer esta factura. Ingrésala manualmente.", variant: "destructive" });
                const fileNameWithoutExt = item.file?.name ? item.file.name.replace(/\.[^/.]+$/, "") : '';
                setNewExpense({
                    date: new Date(),
                    description: fileNameWithoutExt,
                    amount: '',
                    category: 'Inventario',
                    supplier_name: '',
                    invoice_number: '',
                    image_url: previewUrl
                });
            }
        }
    }, [reviewIndex, scanQueue]);

    const handleSkipItem = () => {
        let nextIndex = -1;
        for (let offset = 1; offset < scanQueue.length; offset++) {
            const checkIdx = (reviewIndex + offset) % scanQueue.length;
            const checkItem = scanQueue[checkIdx];
            if (checkItem && (checkItem.status === 'success' || checkItem.status === 'error')) {
                nextIndex = checkIdx;
                break;
            }
        }

        if (nextIndex !== -1) {
            setReviewIndex(nextIndex);
        } else {
            toast({ title: "Fin de la lista", description: "No hay más facturas para revisar en este momento." });
        }
    };

    const handleSaveAllReady = async () => {
        const readyItems = scanQueue.filter(item => item.status === 'success' && item.extractedData);
        if (readyItems.length === 0) {
            toast({ title: "Sin facturas listas", description: "No hay facturas listas para guardar." });
            return;
        }
        
        setIsScanning(true);
        let count = 0;
        try {
            for (const item of readyItems) {
                const supplierNameInput = item.extractedData.supplier_name ? item.extractedData.supplier_name.trim() : "";
                let finalSupplierId = null;

                if (supplierNameInput) {
                    const existingSupplier = suppliers.find(s => s.name?.toLowerCase() === supplierNameInput.toLowerCase());
                    if (existingSupplier) {
                        finalSupplierId = existingSupplier.id;
                    } else {
                        try {
                            const newSup = await createSupplier({ name: supplierNameInput, rnc: null, contact: null });
                            if (newSup && newSup.id) {
                                finalSupplierId = newSup.id;
                            }
                        } catch (supErr) {
                            console.error("Failed to auto-create supplier:", supErr);
                        }
                    }
                }

                await createExpense({
                    date: item.extractedData.date ? new Date(item.extractedData.date) : new Date(),
                    description: item.extractedData.description || `Gasto en ${item.extractedData.supplier_name || 'Desconocido'}`,
                    amount: typeof item.extractedData.amount === 'number' ? item.extractedData.amount : (parseFloat(item.extractedData.amount) || 0),
                    category: item.extractedData.category || 'Otros',
                    supplier_id: finalSupplierId,
                    invoice_number: item.extractedData.invoice_number,
                    image_url: item.extractedData.image_url
                });

                setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved' } : i));
                count++;
            }
            toast({ title: "Guardado Masivo", description: `Se guardaron ${count} facturas correctamente.` });
        } catch (err: any) {
            console.error("Error in handleSaveAllReady:", err);
            toast({ title: "Error al guardar", description: err.message || "Ocurrió un error al guardar las facturas.", variant: "destructive" });
        } finally {
            setIsScanning(false);
        }
    };

    const handleAddExpense = async () => {
        console.log("Attempting to add expense:", newExpense);

        if (!newExpense.amount || !newExpense.description) {
            toast({
                title: "Campos requeridos",
                description: "Por favor completa el monto y la descripción.",
                variant: "destructive"
            });
            return;
        }

        try {
            // Handle Supplier: Find existing or Auto-Create
            const supplierNameInput = newExpense.supplier_name ? newExpense.supplier_name.trim() : "";
            let finalSupplierId = null;

            if (supplierNameInput) {
                const existingSupplier = suppliers.find(s => s.name?.toLowerCase() === supplierNameInput.toLowerCase());

                if (existingSupplier) {
                    finalSupplierId = existingSupplier.id;
                } else {
                    // Auto-create new supplier silently to proceed with expense
                    try {
                        console.log("Auto-creating supplier:", supplierNameInput);
                        const newSup = await createSupplier({
                            name: supplierNameInput,
                            rnc: null,
                            contact: null
                        });
                        if (newSup && newSup.id) {
                            finalSupplierId = newSup.id;
                        }
                    } catch (supErr) {
                        console.error("Failed to auto-create supplier, proceeding without link:", supErr);
                    }
                }
            }

            let finalImageUrl = newExpense.image_url;
            const currentItem = scanQueue.length > 0 ? scanQueue[reviewIndex] : null;

            if ((!finalImageUrl || finalImageUrl.startsWith('blob:')) && currentItem?.file) {
                const uploadedUrl = await uploadReceiptImage(currentItem.file);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                }
            }

            const saveDate = newExpense.date instanceof Date ? newExpense.date : new Date(newExpense.date || Date.now());

            await createExpense({
                date: saveDate,
                description: newExpense.description,
                amount: Number(newExpense.amount),
                category: newExpense.category || 'Otros',
                supplier_id: finalSupplierId,
                invoice_number: newExpense.invoice_number,
                image_url: finalImageUrl,
                created_at: saveDate.toISOString()
            });

            console.log("Expense created successfully via mutation");

            toast({ title: "Guardado", description: "Gasto registrado exitosamente." });

            if (scanQueue.length > 0) {
                // Mark current item as saved in scanQueue
                if (currentItem) {
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'saved', imageUrl: finalImageUrl || i.imageUrl } : i));
                }

                // Find the next item that is 'success' or 'error' and not 'saved'
                let nextIndex = -1;
                for (let offset = 1; offset <= scanQueue.length; offset++) {
                    const checkIdx = (reviewIndex + offset) % scanQueue.length;
                    const checkItem = scanQueue[checkIdx];
                    if (checkItem && checkItem.id !== currentItem?.id && (checkItem.status === 'success' || checkItem.status === 'error')) {
                        nextIndex = checkIdx;
                        break;
                    }
                }

                if (nextIndex !== -1) {
                    setReviewIndex(nextIndex);
                } else {
                    toast({ title: "Proceso Completo", description: "Todas las facturas de la lista han sido guardadas." });
                }
            } else {
                // Single/Manual Mode
                setIsAddExpenseOpen(false);
                setNewExpense({
                    date: new Date(),
                    description: '',
                    amount: '',
                    category: 'Inventario',
                    supplier_name: '',
                    invoice_number: '',
                    image_url: null
                });
            }



        } catch (error: any) {
            console.error("Error in handleAddExpense:", error);
            toast({
                title: "Error al guardar",
                description: error.message || "Ocurrió un error inesperado.",
                variant: "destructive"
            });
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (confirm('¿Estás seguro de borrar este gasto?')) {
            await deleteExpense(id);
        }
    };

    const handleStartEditExpense = (expense: Expense) => {
        const formattedDate = expense.date && isValid(new Date(expense.date))
            ? format(new Date(expense.date), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd');

        setEditExpenseForm({
            description: expense.description || '',
            amount: expense.amount ? expense.amount.toString() : '',
            category: expense.category || 'Otros',
            supplier_name: expense.supplier_name && expense.supplier_name !== 'N/A' ? expense.supplier_name : '',
            supplier_id: expense.supplier_id || null,
            date: formattedDate,
            invoice_number: expense.invoice_number || '',
            image_url: expense.image_url || null,
        });
        setIsEditingExpenseDetails(true);
    };

    const handleUploadEditImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        try {
            setIsUploadingEditImage(true);
            const uploadedUrl = await uploadReceiptImage(files[0]);
            if (uploadedUrl) {
                setEditExpenseForm(prev => ({ ...prev, image_url: uploadedUrl }));
                toast({ title: "Comprobante actualizado", description: "La imagen del comprobante se ha subido." });
            } else {
                toast({ variant: "destructive", title: "Error", description: "No se pudo subir la imagen." });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message || "Error al subir imagen." });
        } finally {
            setIsUploadingEditImage(false);
        }
    };

    const handleSaveEditedExpense = async () => {
        if (!selectedExpenseForDetails) return;
        if (!editExpenseForm.description.trim() || !editExpenseForm.amount) {
            toast({
                variant: "destructive",
                title: "Campos requeridos",
                description: "El concepto y el monto son obligatorios."
            });
            return;
        }

        try {
            let finalSupplierId = editExpenseForm.supplier_id;
            const trimmedSupplier = editExpenseForm.supplier_name.trim();
            if (trimmedSupplier) {
                const foundSupplier = suppliers.find(s => s.name.toLowerCase() === trimmedSupplier.toLowerCase());
                if (foundSupplier) {
                    finalSupplierId = foundSupplier.id;
                } else {
                    try {
                        const newSup = await createSupplier({ name: trimmedSupplier });
                        if (newSup?.id) finalSupplierId = newSup.id;
                    } catch (e) {
                        console.warn("No se pudo autocrear el proveedor:", e);
                    }
                }
            } else {
                finalSupplierId = null;
            }

            const dateObj = editExpenseForm.date ? new Date(`${editExpenseForm.date}T12:00:00`) : new Date();

            const updated = await updateExpense({
                id: selectedExpenseForDetails.id,
                description: editExpenseForm.description.trim(),
                amount: parseFloat(editExpenseForm.amount) || 0,
                category: editExpenseForm.category || 'Otros',
                supplier_id: finalSupplierId,
                supplier_name: trimmedSupplier || 'N/A',
                invoice_number: editExpenseForm.invoice_number.trim() || null,
                image_url: editExpenseForm.image_url || null,
                date: dateObj
            });

            const mergedUpdated: Expense = updated ? {
                ...selectedExpenseForDetails,
                ...updated,
                supplier_name: trimmedSupplier || 'N/A'
            } : {
                ...selectedExpenseForDetails,
                description: editExpenseForm.description.trim(),
                amount: parseFloat(editExpenseForm.amount) || 0,
                category: editExpenseForm.category || 'Otros',
                supplier_id: finalSupplierId,
                supplier_name: trimmedSupplier || 'N/A',
                invoice_number: editExpenseForm.invoice_number.trim() || null,
                image_url: editExpenseForm.image_url || null,
                date: dateObj
            };

            setSelectedExpenseForDetails(mergedUpdated);
            setIsEditingExpenseDetails(false);
        } catch (err: any) {
            console.error("Error guardando cambios del gasto:", err);
        }
    };

    const handleDeleteExpenseFromDetails = async () => {
        if (!selectedExpenseForDetails) return;
        if (confirm("¿Estás seguro de que deseas eliminar este gasto?")) {
            await deleteExpense(selectedExpenseForDetails.id);
            setIsDetailsOpen(false);
            setSelectedExpenseForDetails(null);
            setIsEditingExpenseDetails(false);
        }
    };

    const handleAddSupplier = async () => {
        if (!newSupplier.name?.trim()) {
            toast({
                variant: "destructive",
                title: "Campo requerido",
                description: "Por favor ingresa el nombre del proveedor.",
            });
            return;
        }

        try {
            if (editingSupplier) {
                await updateSupplier({
                    id: editingSupplier.id,
                    name: newSupplier.name.trim(),
                    rnc: newSupplier.rnc?.trim() || null,
                    contact: newSupplier.contact?.trim() || null,
                    phone: newSupplier.phone?.trim() || null,
                    payment_method: newSupplier.payment_method || 'transfer',
                    bank_name: newSupplier.bank_name?.trim() || null,
                    bank_account_number: newSupplier.bank_account_number?.trim() || null,
                    bank_account_type: newSupplier.bank_account_type || null,
                });
            } else {
                await createSupplier({
                    name: newSupplier.name.trim(),
                    rnc: newSupplier.rnc?.trim() || null,
                    contact: newSupplier.contact?.trim() || null,
                    phone: newSupplier.phone?.trim() || null,
                    payment_method: newSupplier.payment_method || 'transfer',
                    bank_name: newSupplier.bank_name?.trim() || null,
                    bank_account_number: newSupplier.bank_account_number?.trim() || null,
                    bank_account_type: newSupplier.bank_account_type || null,
                });
            }
            setIsAddSupplierOpen(false);
            setEditingSupplier(null);
            setNewSupplier({ payment_method: 'transfer' });
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenEditSupplier = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setNewSupplier({
            name: supplier.name,
            rnc: supplier.rnc || '',
            contact: supplier.contact || '',
            phone: supplier.phone || '',
            payment_method: supplier.payment_method || 'transfer',
            bank_name: supplier.bank_name || '',
            bank_account_number: supplier.bank_account_number || '',
            bank_account_type: supplier.bank_account_type || '',
        });
        setIsAddSupplierOpen(true);
    };

    const handleOpenCreateSupplier = () => {
        setEditingSupplier(null);
        setNewSupplier({ payment_method: 'transfer' });
        setIsAddSupplierOpen(true);
    };

    const handleCopyAccount = (accountNumber: string) => {
        if (!accountNumber) return;
        navigator.clipboard.writeText(accountNumber);
        toast({
            title: "¡Cuenta bancaria copiada!",
            description: `Número ${accountNumber} copiado al portapapeles.`,
        });
    };

    const saveExpenseToDb = async (data: any) => {
        const foundSupplier = suppliers.find(s => s.name.toLowerCase() === (data.supplier_name || '').trim().toLowerCase());

        await createExpense({
            date: data.date ? new Date(data.date) : new Date(),
            description: data.description || `Gasto en ${data.supplier_name || 'Desconocido'}`,
            amount: typeof data.amount === 'number' ? data.amount : (parseFloat(data.amount) || 0),
            category: data.category || 'Otros',
            supplier_id: foundSupplier?.id || null,
            invoice_number: data.invoice_number,
            image_url: data.image_url || null
        });

        // Notify if supplier is new, just as a warning/info
        if (data.supplier_name && !foundSupplier) {
            console.log(`Proveedor nuevo detectado: ${data.supplier_name}`);
        }
    };

    const uploadReceiptImage = async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `expenses/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                console.error('[Storage] Error uploading receipt:', uploadError.message);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (err) {
            console.error('[Storage] Exception uploading receipt:', err);
            return null;
        }
    };


    const handleManualImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsUploadingManualImage(true);
            const file = files[0];
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `expenses/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                throw new Error(uploadError.message);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            setNewExpense(prev => ({ ...prev, image_url: publicUrl }));
            toast({ title: "Comprobante adjuntado", description: "La imagen se ha subido correctamente." });
        } catch (err: any) {
            console.error('Error subiendo comprobante manual:', err);
            toast({
                variant: "destructive",
                title: "Error al subir imagen",
                description: err.message || "Error desconocido al subir el comprobante.",
            });
        } finally {
            setIsUploadingManualImage(false);
            if (manualFileInputRef.current) manualFileInputRef.current.value = '';
        }
    };

    const handleDownloadImage = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'factura-comprobante.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error al descargar la imagen:', error);
            window.open(url, '_blank');
        }
    };

    const processQueueItems = async (itemsToProcess: QueueItem[]) => {
        const apiKey = resolveActiveAiApiKey(storeSettings);

        if (!apiKey) {
            toast({ title: "Requerido", description: "Primero guarda tu API Key de Groq en la configuración.", variant: "destructive" });
            return;
        }

        setIsScanning(true);

        try {
            for (let i = 0; i < itemsToProcess.length; i++) {
                const item = itemsToProcess[i];
                // Marcar como escaneando
                setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'scanning', statusMessage: undefined } : q));

                let imageUrl = item.imageUrl;

                try {
                    console.log(`Uploading receipt image to storage...`);
                    if (!imageUrl || imageUrl.startsWith('blob:')) {
                        const uploadedUrl = await uploadReceiptImage(item.file);
                        if (uploadedUrl) imageUrl = uploadedUrl;
                    }

                    console.log(`Scanning item ${item.file.name}...`);
                    const data = await scanInvoiceExpense(item.file, apiKey, (statusMsg) => {
                        setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, statusMessage: statusMsg } : q));
                    });

                    const dataWithImage = { ...data, image_url: imageUrl || item.imageUrl };

                    setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', extractedData: dataWithImage, imageUrl: imageUrl || item.imageUrl, statusMessage: undefined } : q));
                    console.log(`✅ Factura procesada exitosamente.`);

                    // Pausa de 2.5s entre solicitudes para evitar sobrepasar límites de tokens por minuto (TPM)
                    if (i < itemsToProcess.length - 1) {
                        await new Promise(res => setTimeout(res, 2500));
                    }
                } catch (err: any) {
                    console.error(`❌ Error procesando factura (${item.file.name}):`, err);
                    const errorMsg = err.message || "Error desconocido";

                    if (!imageUrl || imageUrl.startsWith('blob:')) {
                        const uploadedUrl = await uploadReceiptImage(item.file);
                        if (uploadedUrl) imageUrl = uploadedUrl;
                    }

                    setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: errorMsg, imageUrl: imageUrl || item.imageUrl, statusMessage: undefined } : q));

                    if (itemsToProcess.length === 1) {
                        toast({
                            title: "Error de Escaneo",
                            description: errorMsg.includes("429") ? "Límite de solicitudes por minuto alcanzado. Haz clic en Reintentar o ingrésala manual." :
                                         errorMsg.includes("401") ? "API Key inválida o vencida." :
                                         errorMsg.includes("413") ? "Imagen demasiado grande." :
                                         errorMsg,
                            variant: "destructive"
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Batch error:", error);
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const processReceiptImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newItems: QueueItem[] = Array.from(files).map(f => {
            let blobUrl: string | undefined = undefined;
            try {
                blobUrl = URL.createObjectURL(f);
            } catch (e) {
                console.error("Error creating Object URL:", e);
            }
            return {
                id: Math.random().toString(36).substr(2, 9),
                file: f,
                status: 'pending',
                imageUrl: blobUrl
            };
        });

        const prevLength = scanQueue.length;
        setScanQueue(prev => [...prev, ...newItems]);
        setReviewIndex(prevLength);
        console.log(`🚀 Iniciando escaneo de ${newItems.length} nuevos archivos...`);

        await processQueueItems(newItems);
    };

    const handleRetryFailedItems = async () => {
        const failedItems = scanQueue.filter(item => item.status === 'error');
        if (failedItems.length === 0) return;

        setScanQueue(prev => prev.map(q => q.status === 'error' ? { ...q, status: 'pending', error: undefined, statusMessage: undefined } : q));
        await processQueueItems(failedItems);
    };

    const handleRetrySingleItem = async (itemId: string) => {
        const item = scanQueue.find(q => q.id === itemId);
        if (!item) return;

        setScanQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'pending', error: undefined, statusMessage: undefined } : q));
        await processQueueItems([item]);
    };

    const resetApiKey = () => {
        if (confirm("¿Borrar la API Key de IA guardada? Tendrás que ingresarla de nuevo la próxima vez.")) {
            updateSettings({ ai_api_key: null });
            setApiKeyInput('');
            toast({ title: "API Key borrada" });
        }
    };

    return (
        <div className="p-6 pb-24 space-y-10 animate-in fade-in duration-500">
            {/* Centered Premium Header */}
            <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-8 py-4">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.1em] leading-normal py-1">Contabilidad</h1>
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <div className="h-px w-6 bg-border" />
                        <p className="text-xs font-bold uppercase tracking-widest">Gestión financiera y gastos</p>
                        <div className="h-px w-6 bg-border" />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                    {/* Month Selector Centered */}
                    <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-2xl border border-border/50 shadow-inner w-full max-w-[280px] justify-between">
                        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-10 w-10 rounded-xl hover:bg-background">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[11px] text-primary">
                            <Calendar className="h-4 w-4" />
                            <span>
                                {currentDate ? format(currentDate, 'MMMM yyyy', { locale: es }) : ''}
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-10 w-10 rounded-xl hover:bg-background">
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Main Action Button Centered */}
                    <Button 
                        id="accounting-add-expense-btn" 
                        onClick={() => {
                            setNewExpense({
                                date: new Date(),
                                description: '',
                                amount: '',
                                category: 'Inventario',
                                supplier_name: '',
                                invoice_number: ''
                            });
                            setScanQueue([]);
                            setReviewIndex(0);
                            setIsScanning(false);
                            setExpenseType('reinversion');
                            setIsAddExpenseOpen(true);
                        }} 
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-10 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 w-full sm:w-auto transition-all active:scale-95"
                    >
                        <Plus className="h-5 w-5" />
                        Registrar Gasto
                    </Button>
                </div>
            </div>

            {/* Impact Metrics Grid */}
            <div id="accounting-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-emerald-500/5 border-emerald-500/20 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-12 w-12 text-emerald-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70">Ingresos (Cobrados)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {loadingSales ? (
                            <Skeleton className="h-10 w-32 bg-emerald-500/10" />
                        ) : (
                            <div className="flex flex-col">
                                <span className="text-3xl font-black text-emerald-500">${Number(collectedSales || 0).toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Excluye créditos pendientes</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/5 border-amber-500/20 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircle className="h-12 w-12 text-amber-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/70">Créditos Pendientes</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {loadingSales ? (
                            <Skeleton className="h-10 w-32 bg-amber-500/10" />
                        ) : (
                            <div className="flex flex-col">
                                <span className="text-3xl font-black text-amber-500">${Number(pendingCreditSales || 0).toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Por cobrar a clientes</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="h-12 w-12 text-primary" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Utilidad Neta (Cobrado)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {loadingSales || loadingExpenses ? (
                            <Skeleton className="h-10 w-32 bg-primary/10" />
                        ) : (
                            <div className="flex flex-col">
                                <span className={`text-3xl font-black ${netIncome >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                    ${Number(netIncome || 0).toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Flujo de caja real</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-red-500/5 border-red-500/20 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingDown className="h-12 w-12 text-red-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70">Total Gastos</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {loadingExpenses ? (
                            <Skeleton className="h-10 w-32 bg-red-500/10" />
                        ) : (
                            <div className="flex flex-col">
                                <span className="text-3xl font-black text-red-500">${Number(totalExpenses || 0).toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Reinv. + Operativos</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Premium Expense Breakdown */}
            {!loadingExpenses && totalExpenses > 0 && (
                <div className="max-w-3xl mx-auto w-full">
                    <Card className="border-0 shadow-2xl bg-muted/10 backdrop-blur-sm overflow-hidden rounded-3xl">
                        <CardContent className="p-8 space-y-8">
                            <div className="flex flex-col items-center text-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Análisis de Distribución</span>
                                <h3 className="text-xl font-black uppercase">Desglose de Gastos</h3>
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mt-2">${totalExpenses.toLocaleString()} TOTAL</span>
                            </div>

                            {/* Refined Progress Bar */}
                            <div className="space-y-3">
                                <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/30 shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                                        style={{ width: `${totalExpenses > 0 ? (reinvestmentExpenses / totalExpenses) * 100 : 0}%` }}
                                    />
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                        style={{ width: `${totalExpenses > 0 ? (operationalExpenses / totalExpenses) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                    <span>Reinversión</span>
                                    <span>Operativos</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col items-center text-center gap-2 p-5 rounded-3xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all">
                                    <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Reinversión</span>
                                    <span className="text-3xl font-black text-blue-500">${reinvestmentExpenses.toLocaleString()}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                        {totalExpenses > 0 ? ((reinvestmentExpenses / totalExpenses) * 100).toFixed(1) : 0}% DEL TOTAL
                                    </span>
                                </div>
                                <div className="flex flex-col items-center text-center gap-2 p-5 rounded-3xl bg-orange-500/5 border border-orange-500/20 hover:bg-orange-500/10 transition-all">
                                    <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Gastos Operativos</span>
                                    <span className="text-3xl font-black text-orange-500">${operationalExpenses.toLocaleString()}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                        {totalExpenses > 0 ? ((operationalExpenses / totalExpenses) * 100).toFixed(1) : 0}% DEL TOTAL
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs id="accounting-tabs" defaultValue="expenses" className="space-y-8">
                <div className="flex justify-center w-full max-w-full overflow-x-auto px-1">
                    <TabsList className="bg-muted/20 p-1 rounded-2xl border border-border/50 h-auto self-center flex-nowrap max-w-full overflow-x-auto justify-start sm:justify-center whitespace-nowrap scrollbar-none">
                        <TabsTrigger value="expenses" className="rounded-xl px-3 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg shrink-0">Gastos</TabsTrigger>
                        <TabsTrigger value="fixed-expenses" className="rounded-xl px-3 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg shrink-0">Gastos Fijos</TabsTrigger>
                        <TabsTrigger value="suppliers" className="rounded-xl px-3 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg shrink-0">Proveedores</TabsTrigger>
                        <TabsTrigger value="reports" className="rounded-xl px-3 sm:px-6 py-2 sm:py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg shrink-0">Reportes</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="expenses" className="space-y-6">
                    {/* Main Search & Advanced Filter Controls */}
                    <div className="max-w-3xl mx-auto w-full space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            {/* Search Input with Clear Button */}
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                                <Input 
                                    placeholder="Buscar por descripción, proveedor, comprobante, categoría..." 
                                    value={expenseSearchQuery}
                                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                                    className="pl-11 pr-10 h-12 bg-muted/20 border-border/50 rounded-2xl focus:ring-primary/20 text-sm font-medium" 
                                />
                                {expenseSearchQuery && (
                                    <button
                                        onClick={() => setExpenseSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/40 transition-colors"
                                        title="Limpiar búsqueda"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Advanced Filters Popover */}
                            <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className={cn(
                                            "h-12 px-4 sm:px-5 rounded-2xl border-border/50 font-bold text-xs gap-2 shrink-0 transition-all",
                                            hasActiveExpenseFilters 
                                                ? "bg-primary/10 border-primary text-primary hover:bg-primary/20 shadow-md" 
                                                : "bg-muted/20 hover:bg-muted/30"
                                        )}
                                    >
                                        <Filter className="h-4 w-4" />
                                        <span>Filtros</span>
                                        {hasActiveExpenseFilters && (
                                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-5 rounded-3xl space-y-4 border-border/60 shadow-2xl bg-card" align="end">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-primary" />
                                            <h4 className="font-black text-sm uppercase tracking-wider">Filtrar Gastos</h4>
                                        </div>
                                        {hasActiveExpenseFilters && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={clearExpenseFilters}
                                                className="h-7 px-2 text-[10px] font-black uppercase text-destructive hover:bg-destructive/10 rounded-lg"
                                            >
                                                Limpiar todo
                                            </Button>
                                        )}
                                    </div>

                                    {/* Filter by Category */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Categoría</Label>
                                        <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50 text-xs font-bold">
                                                <SelectValue placeholder="Todas las categorías" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl">
                                                <SelectItem value="all" className="text-xs font-bold">Todas las categorías</SelectItem>
                                                {CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat} value={cat} className="text-xs font-semibold">
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Filter by Expense Type */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Tipo de Gasto</Label>
                                        <Select value={expenseTypeFilter} onValueChange={(val: any) => setExpenseTypeFilter(val)}>
                                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50 text-xs font-bold">
                                                <SelectValue placeholder="Todos los tipos" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl">
                                                <SelectItem value="all" className="text-xs font-bold">Todos los tipos</SelectItem>
                                                <SelectItem value="reinversion" className="text-xs font-semibold text-blue-500">Reinversión (Inventario)</SelectItem>
                                                <SelectItem value="operativo" className="text-xs font-semibold text-orange-500">Gastos Operativos</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Filter by Attachment */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Factura Adjunta</Label>
                                        <Select value={expenseHasReceiptFilter} onValueChange={(val: any) => setExpenseHasReceiptFilter(val)}>
                                            <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-border/50 text-xs font-bold">
                                                <SelectValue placeholder="Todos los comprobantes" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl">
                                                <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                                <SelectItem value="with_receipt" className="text-xs font-semibold text-green-500">📎 Con Factura/Imagen</SelectItem>
                                                <SelectItem value="without_receipt" className="text-xs font-semibold text-muted-foreground">Sin Comprobante</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pt-2 flex justify-end">
                                        <Button 
                                            size="sm" 
                                            onClick={() => setIsFilterPopoverOpen(false)}
                                            className="w-full bg-primary text-primary-foreground font-black text-xs h-9 rounded-xl uppercase tracking-wider"
                                        >
                                            Aplicar Filtros
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Quick Filter Badges / Chips */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 overflow-x-auto pb-1 scrollbar-none">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mr-1">Rápidos:</span>
                            
                            <button
                                onClick={() => {
                                    setExpenseCategoryFilter('all');
                                    setExpenseTypeFilter('all');
                                    setExpenseHasReceiptFilter('all');
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                    !hasActiveExpenseFilters && !expenseSearchQuery
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-muted/20 hover:bg-muted/40 text-muted-foreground border-border/40"
                                )}
                            >
                                Todos ({filteredExpenses.length})
                            </button>

                            <button
                                onClick={() => setExpenseCategoryFilter(expenseCategoryFilter === 'Inventario' ? 'all' : 'Inventario')}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                    expenseCategoryFilter === 'Inventario'
                                        ? "bg-blue-500 text-white border-blue-600 shadow-sm"
                                        : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20"
                                )}
                            >
                                📦 Inventario
                            </button>

                            <button
                                onClick={() => setExpenseTypeFilter(expenseTypeFilter === 'operativo' ? 'all' : 'operativo')}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                    expenseTypeFilter === 'operativo'
                                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                                        : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20"
                                )}
                            >
                                ⚙️ Operativos
                            </button>

                            <button
                                onClick={() => setExpenseHasReceiptFilter(expenseHasReceiptFilter === 'with_receipt' ? 'all' : 'with_receipt')}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                    expenseHasReceiptFilter === 'with_receipt'
                                        ? "bg-green-500 text-white border-green-600 shadow-sm"
                                        : "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20"
                                )}
                            >
                                📎 Con Factura
                            </button>

                            {hasActiveExpenseFilters && (
                                <button
                                    onClick={clearExpenseFilters}
                                    className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 transition-all ml-auto flex items-center gap-1"
                                >
                                    <X className="h-3 w-3" /> Limpiar Filtros
                                </button>
                            )}
                        </div>

                        {/* Results Counter Banner */}
                        {hasActiveExpenseFilters && (
                            <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground font-semibold">
                                <span>
                                    Mostrando <strong className="text-foreground">{searchedAndFilteredExpenses.length}</strong> de <strong className="text-foreground">{filteredExpenses.length}</strong> gastos este mes
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-hidden rounded-3xl border border-border/50 shadow-xl bg-card">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none">
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Fecha</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Descripción</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Proveedor</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] tracking-widest py-5">Categoría</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px] tracking-widest py-5 pr-8">Monto</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingExpenses ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-48 text-center"><LoadingLogo size="sm" /></TableCell>
                                        </TableRow>
                                    ) : searchedAndFilteredExpenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-36 text-center text-muted-foreground font-bold">
                                                {hasActiveExpenseFilters ? (
                                                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                                                        <p className="text-sm text-foreground">No se encontraron gastos con los filtros aplicados</p>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={clearExpenseFilters}
                                                            className="rounded-xl font-black text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                                                        >
                                                            <X className="h-3.5 w-3.5" /> Limpiar filtros
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="italic">No hay registros este mes</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        searchedAndFilteredExpenses.map((expense) => (
                                            <TableRow
                                                key={expense.id}
                                                className="hover:bg-muted/20 cursor-pointer transition-colors border-b border-border/30"
                                                onClick={() => {
                                                    setSelectedExpenseForDetails(expense);
                                                    setIsDetailsOpen(true);
                                                }}
                                            >
                                                <TableCell className="text-[11px] font-bold text-muted-foreground">
                                                    {expense.date && isValid(expense.date) ? format(expense.date, 'dd/MM/yyyy') : '-'}
                                                </TableCell>
                                                <TableCell className="font-bold text-sm tracking-tight">
                                                    <div className="flex items-center gap-2">
                                                        <span>{expense.description}</span>
                                                        {expense.image_url && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-black uppercase border border-green-500/20">
                                                                📎 Factura
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-[11px] font-black uppercase text-primary/70">{expense.supplier_name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${isReinvestment(expense.category) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                                        {expense.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-base pr-8">
                                                    ${(expense.amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteExpense(expense.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View - PREMIER DESIGN */}
                        <div className="md:hidden space-y-4">
                            {loadingExpenses ? (
                                <div className="p-12 flex justify-center"><LoadingLogo size="sm" /></div>
                            ) : searchedAndFilteredExpenses.length === 0 ? (
                                <div className="p-8 text-center bg-card rounded-3xl border border-dashed border-border/60 space-y-3">
                                    <p className="text-xs font-black uppercase text-muted-foreground tracking-wider">
                                        {hasActiveExpenseFilters ? 'Sin resultados para estos filtros' : 'Sin registros este mes'}
                                    </p>
                                    {hasActiveExpenseFilters && (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={clearExpenseFilters}
                                            className="rounded-xl font-black text-xs gap-1 text-primary border-primary/30"
                                        >
                                            <X className="h-3.5 w-3.5" /> Limpiar Filtros
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                searchedAndFilteredExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className="bg-muted/10 border border-border/50 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden group active:bg-muted/20 cursor-pointer transition-all hover:border-green-500/30"
                                        onClick={() => {
                                            setSelectedExpenseForDetails(expense);
                                            setIsDetailsOpen(true);
                                        }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                                    {expense.date && isValid(expense.date) ? format(expense.date, 'dd MMM yyyy', { locale: es }) : '-'}
                                                </span>
                                                <h4 className="font-black text-lg leading-tight tracking-tight">{expense.description}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                                                        <Building2 className="h-2.5 w-2.5 text-primary" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase text-primary/80 tracking-wider">
                                                        {expense.supplier_name || 'Sin Proveedor'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-xl font-black text-foreground tracking-tighter">${(expense.amount || 0).toLocaleString()}</span>
                                                <span className={`mt-1 inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${isReinvestment(expense.category) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                                    {expense.category}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-3 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex gap-2">
                                                {expense.image_url && (
                                                    <span className="text-[9px] font-black uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">
                                                        📎 Con Factura
                                                    </span>
                                                )}
                                                {expense.invoice_number && (
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted border border-border/30 px-2 py-0.5 rounded-lg">
                                                        #{expense.invoice_number}
                                                    </span>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 px-3 rounded-xl text-destructive hover:bg-destructive/10 gap-2" onClick={() => handleDeleteExpense(expense.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-black uppercase">Eliminar</span>
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </TabsContent>



                <TabsContent value="suppliers" className="space-y-5 animate-in fade-in duration-300">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold tracking-tight">Proveedores</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''} registrado{suppliers.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 h-9 px-4 rounded-xl shadow-sm"
                            onClick={handleOpenCreateSupplier}
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Proveedor
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    {(() => {
                        const withDebt = suppliers.filter(s => getSupplierOutstandingDebt(s.id) > 0);
                        const totalDebt = suppliers.reduce((sum, s) => sum + getSupplierOutstandingDebt(s.id), 0);
                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Proveedores</p>
                                    <p className="text-2xl font-black mt-1">{suppliers.length}</p>
                                </div>
                                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Con Deuda Pendiente</p>
                                    <p className="text-2xl font-black mt-1 text-red-500">{withDebt.length}</p>
                                </div>
                                <div className="rounded-xl border border-border/30 bg-card/50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deuda Total</p>
                                    <p className="text-2xl font-black mt-1">${totalDebt.toLocaleString()}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Search & Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, RNC, banco, cuenta o teléfono..."
                                value={supplierSearch}
                                onChange={(e) => setSupplierSearch(e.target.value)}
                                className="pl-9 h-9 bg-muted/20 border-border/40 rounded-xl text-sm"
                            />
                        </div>
                        <div className="flex gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/30">
                            {([
                                { key: 'all', label: 'Todos' },
                                { key: 'with_debt', label: 'Con Deuda' },
                                { key: 'no_debt', label: 'Sin Deuda' },
                            ] as const).map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSupplierDebtFilter(key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        supplierDebtFilter === key
                                            ? 'bg-background shadow-sm text-foreground border border-border/40'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    {(() => {
                        const filtered = suppliers
                            .filter(s => {
                                const term = supplierSearch.toLowerCase();
                                const matchSearch = !term ||
                                    s.name?.toLowerCase().includes(term) ||
                                    (s.rnc || '').toLowerCase().includes(term) ||
                                    (s.contact || '').toLowerCase().includes(term) ||
                                    (s.phone || '').toLowerCase().includes(term) ||
                                    (s.bank_name || '').toLowerCase().includes(term) ||
                                    (s.bank_account_number || '').toLowerCase().includes(term);
                                const debt = getSupplierOutstandingDebt(s.id);
                                const matchFilter =
                                    supplierDebtFilter === 'all' ||
                                    (supplierDebtFilter === 'with_debt' && debt > 0) ||
                                    (supplierDebtFilter === 'no_debt' && debt === 0);
                                return matchSearch && matchFilter;
                            })
                            .sort((a, b) => {
                                return getSupplierOutstandingDebt(b.id) - getSupplierOutstandingDebt(a.id);
                            });

                        if (loadingSuppliers) {
                            return (
                                <div className="flex justify-center items-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            );
                        }

                        if (filtered.length === 0) {
                            return (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Building2 className="h-10 w-10 mx-auto opacity-20 mb-3" />
                                    <p className="text-sm font-medium">
                                        {supplierSearch || supplierDebtFilter !== 'all'
                                            ? 'No se encontraron proveedores con esos filtros.'
                                            : 'Aún no tienes proveedores registrados.'}
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card shadow-sm">
                                <Table className="border-collapse">
                                    <TableHeader>
                                        <TableRow className="border-b border-border/40 hover:bg-transparent">
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3 pl-5">Proveedor</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3">RNC</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3">Contacto / Teléfono</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3 text-right">Deuda Pendiente</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3 text-center pr-5">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((supplier) => {
                                            const outstanding = getSupplierOutstandingDebt(supplier.id);
                                            const hasDebt = outstanding > 0;
                                            const isTransfer = (supplier.payment_method || 'transfer') === 'transfer';

                                            return (
                                                <TableRow
                                                    key={supplier.id}
                                                    className="hover:bg-muted/30 transition-colors border-b border-border/20 group cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedSupplierForView(supplier);
                                                        setIsViewDebtsOpen(true);
                                                    }}
                                                >
                                                    <TableCell className="py-4 pl-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                                                                hasDebt ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                                                            }`}>
                                                                {supplier.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                                                    {supplier.name}
                                                                    {isTransfer ? (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                                            Transferencia
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                                            Efectivo
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                {(supplier.bank_name || supplier.bank_account_number) && (
                                                                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                                                        <Landmark className="h-3 w-3 text-muted-foreground/70" />
                                                                        {supplier.bank_name || 'Banco'} {supplier.bank_account_number ? `• ${supplier.bank_account_number}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm text-muted-foreground font-mono">
                                                        {supplier.rnc || <span className="text-border">—</span>}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm text-muted-foreground">
                                                        <div className="flex flex-col gap-0.5">
                                                            {supplier.phone && (
                                                                <span className="font-semibold text-foreground flex items-center gap-1 text-xs">
                                                                    <Phone className="h-3 w-3 text-primary" />
                                                                    {supplier.phone}
                                                                </span>
                                                            )}
                                                            {supplier.contact && (
                                                                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                                                    {supplier.contact}
                                                                </span>
                                                            )}
                                                            {!supplier.phone && !supplier.contact && <span className="text-border">—</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 text-right">
                                                        {hasDebt ? (
                                                            <span className="inline-flex items-center gap-1 text-sm font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-lg">
                                                                ${outstanding.toLocaleString()}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                                                Sin deuda
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-4 pr-5" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-primary hover:bg-primary/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSupplierForDebt(supplier);
                                                                    setDebtForm({ amount: '', description: '', category: 'Inventario', due_date: '' });
                                                                    setIsAddDebtOpen(true);
                                                                }}
                                                                title="Agregar Deuda"
                                                            >
                                                                <Plus className="h-3.5 w-3.5" /> Deuda
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSupplierForView(supplier);
                                                                    setIsViewDebtsOpen(true);
                                                                }}
                                                                title="Ver Ficha Completa"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" /> Ver
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-amber-500 hover:bg-amber-500/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenEditSupplier(supplier);
                                                                }}
                                                                title="Editar Proveedor"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" /> Editar
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteSupplier(supplier.id, supplier.name);
                                                                }}
                                                                title="Eliminar Proveedor"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        );
                    })()}
                </TabsContent>

                <TabsContent value="reports" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Resultados</CardTitle>
                            <CardDescription>Resumen de Ganancias y Pérdidas del Periodo</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between py-2 border-b items-center">
                                    <span className="font-medium">Ingresos por Ventas (Cobrados)</span>
                                    {loadingSales ? <Skeleton className="h-5 w-24" /> : <span className="text-green-600 font-bold">${Number(collectedSales || 0).toLocaleString()}</span>}
                                </div>
                                <div className="flex justify-between py-2 border-b items-center">
                                    <span className="font-medium flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                        Reinversión (Inventario/Mercancía)
                                    </span>
                                    {loadingExpenses ? <Skeleton className="h-5 w-24" /> : <span className="text-blue-500 font-bold">-${Number(reinvestmentExpenses || 0).toLocaleString()}</span>}
                                </div>
                                <div className="flex justify-between py-2 border-b items-center">
                                    <span className="font-medium flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                                        Gastos Operativos (Alquiler, Nómina, etc.)
                                    </span>
                                    {loadingExpenses ? <Skeleton className="h-5 w-24" /> : <span className="text-orange-500 font-bold">-${Number(operationalExpenses || 0).toLocaleString()}</span>}
                                </div>
                                <div className="flex justify-between py-4 border-t-2 border-black items-center">
                                    <span className="text-lg font-bold">Utilidad Neta (Flujo Caja)</span>
                                    {loadingSales || loadingExpenses ? <Skeleton className="h-6 w-28" /> : (
                                        <span className={`text-lg font-bold ${netIncome >= 0 ? 'text-primary' : 'text-red-600'}`}>
                                            ${Number(netIncome || 0).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fixed-expenses" className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center max-w-4xl mx-auto w-full gap-4 flex-wrap">
                        <div className="text-left">
                            <h2 className="text-xl font-black uppercase">Gastos Fijos del Mes</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                Control y programación de egresos recurrentes del negocio para el mes de {currentDate ? format(currentDate, 'MMMM yyyy', { locale: es }) : ''}.
                            </p>
                        </div>
                        <Button 
                            onClick={() => {
                                setEditingFixed(null);
                                setFixedForm({
                                    description: '',
                                    amount: '',
                                    category: 'Alquiler',
                                    due_day: '5'
                                });
                                setIsAddFixedOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest px-6 h-11 rounded-xl shadow-md gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Agregar Gasto Fijo
                        </Button>
                    </div>

                    {/* Stats for the month */}
                    {(() => {
                        const totalFixedAmount = fixedExpenses.reduce((sum, fx) => sum + (fx.amount || 0), 0);
                        const paidFixedAmount = fixedExpenses
                            .filter(fx => filteredExpenses.some(e => e.fixed_expense_id === fx.id))
                            .reduce((sum, fx) => sum + (fx.amount || 0), 0);
                        const pendingFixedAmount = totalFixedAmount - paidFixedAmount;

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto w-full">
                                <Card className="bg-muted/10 border-border/50">
                                    <CardHeader className="pb-1 py-3 text-left">
                                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Presupuesto Fijo Total</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 pb-4 text-left">
                                        <span className="text-2xl font-black">${totalFixedAmount.toLocaleString()}</span>
                                    </CardContent>
                                </Card>
                                <Card className="bg-emerald-500/5 border-emerald-500/20">
                                    <CardHeader className="pb-1 py-3 text-left">
                                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Pagado este Mes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 pb-4 text-left">
                                        <span className="text-2xl font-black text-emerald-500">${paidFixedAmount.toLocaleString()}</span>
                                    </CardContent>
                                </Card>
                                <Card className="bg-red-500/5 border-red-500/20">
                                    <CardHeader className="pb-1 py-3 text-left">
                                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-red-500">Pendiente de Pago</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 pb-4 text-left">
                                        <span className="text-2xl font-black text-red-500">${pendingFixedAmount.toLocaleString()}</span>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })()}

                    {/* Search Input for Fixed Expenses */}
                    <div className="relative max-w-md mx-auto w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar gasto fijo por concepto o categoría..."
                            value={fixedExpenseSearch}
                            onChange={(e) => setFixedExpenseSearch(e.target.value)}
                            className="pl-11 pr-10 h-11 bg-muted/20 border-border/50 rounded-2xl text-xs font-medium focus:ring-primary/20"
                        />
                        {fixedExpenseSearch && (
                            <button
                                onClick={() => setFixedExpenseSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/40 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Table View */}
                    <div className="max-w-4xl mx-auto w-full overflow-hidden rounded-2xl border border-border/50 shadow-lg bg-card">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-left">Concepto</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-left">Categoría</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Monto</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-left">Vencimiento</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Estado</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingFixedExpenses ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground mt-2 block">Cargando gastos fijos...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : searchedFixedExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm font-medium">
                                            {fixedExpenseSearch ? 'No se encontraron gastos fijos con ese término de búsqueda.' : 'No tienes gastos fijos mensuales registrados.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    searchedFixedExpenses.map((fixed) => {
                                        const paidExpense = filteredExpenses.find(e => e.fixed_expense_id === fixed.id);
                                        const isPaid = !!paidExpense;

                                        return (
                                            <TableRow key={fixed.id} className="hover:bg-muted/10 transition-colors">
                                                <TableCell className="font-bold text-sm text-left">{fixed.description}</TableCell>
                                                <TableCell className="text-left">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                                                        {fixed.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-sm">${fixed.amount.toLocaleString()}</TableCell>
                                                <TableCell className="font-medium text-xs text-left">Día {fixed.due_day}</TableCell>
                                                <TableCell className="text-center">
                                                    {isPaid ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mx-auto">
                                                            <Check className="h-3 w-3" /> Pagado
                                                        </span>
                                                    ) : (
                                                        <div className="flex justify-center">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleMarkAsPaid(fixed)}
                                                                className="h-7 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all duration-200 active:scale-95 px-3"
                                                            >
                                                                Marcar Pagado
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setEditingFixed(fixed);
                                                                setFixedForm({
                                                                    description: fixed.description,
                                                                    amount: String(fixed.amount),
                                                                    category: fixed.category,
                                                                    due_day: String(fixed.due_day)
                                                                });
                                                                setIsAddFixedOpen(true);
                                                            }}
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                                        >
                                                            <Settings2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleDeleteFixed(fixed.id, fixed.description)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialog: Add Expense */}
            <Dialog open={isAddExpenseOpen} onOpenChange={(open) => {
                setIsAddExpenseOpen(open);
                if (!open) {
                    setIsScanning(false);
                    setScanQueue([]);
                }
            }}>
                <DialogContent centerOnMobile className={cn("p-3 sm:p-6 max-h-[90dvh] gap-3 sm:gap-4 overflow-y-auto overflow-x-hidden w-full transition-all duration-300", scanQueue.length > 0 ? "sm:max-w-4xl" : "sm:max-w-[560px]")}>
                    <DialogHeader>
                        <DialogTitle>
                            {scanQueue.length > 0 ? "Gestión de Facturas (IA)" : "Registrar Nuevo Gasto"}
                        </DialogTitle>
                        <DialogDescription>
                            {scanQueue.length > 0
                                ? "Revisa, edita y confirma la información extraída por la IA de cada comprobante."
                                : "Ingresa los detalles o escanea una factura."}
                        </DialogDescription>
                    </DialogHeader>

                    {(!isKeyConfigured || isEditingKey) && (
                        <div className="bg-muted/50 p-4 rounded-lg space-y-3 mb-4 border border-destructive/20 relative group">
                            <Label className="text-destructive font-bold flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Configuración de IA (Groq)
                            </Label>
                            <p className="text-xs text-muted-foreground w-full">
                                Introduce tu API key de Groq para usar el modelo Qwen 3.6 Vision y escanear tus facturas.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Input 
                                        type={showApiKey ? "text" : "password"} 
                                        placeholder="Pegar código de Groq (gsk_...)..." 
                                        value={apiKeyInput}
                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                        className="pr-10 font-mono text-xs"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    disabled={isTestingApiKey || !apiKeyInput.trim()}
                                    onClick={async () => {
                                        const cleaned = cleanAiKey(apiKeyInput);
                                        if (!cleaned) return;
                                        setIsTestingApiKey(true);
                                        try {
                                            const res = await testGroqApiKey(cleaned);
                                            if (res.success) {
                                                toast({ title: "✅ Conexión Exitosa", description: res.message });
                                            } else {
                                                toast({ title: "❌ Error", description: res.message, variant: "destructive" });
                                            }
                                        } catch (e: any) {
                                            toast({ title: "Error", description: "No se pudo verificar la clave", variant: "destructive" });
                                        } finally {
                                            setIsTestingApiKey(false);
                                        }
                                    }}
                                >
                                    {isTestingApiKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verificar"}
                                </Button>
                                <Button size="sm" onClick={() => {
                                    if (apiKeyInput.trim()) {
                                        updateSettings({ ai_api_key: apiKeyInput.trim() });
                                        setIsEditingKey(false);
                                        setApiKeyInput('');
                                        toast({ title: "Guardado", description: "API Key de Groq configurada correctamente." });
                                    }
                                }}>Guardar</Button>
                                {isEditingKey && (
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingKey(false)}>Cancelar</Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* The Hidden File Input */}
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={processReceiptImage}
                    />

                    {scanQueue.length === 0 ? (
                        /* Standard entry flow (empty queue) */
                        <div className="space-y-4">
                            {/* Mode Selection Toggle */}
                            <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50">
                                <button
                                    type="button"
                                    onClick={() => setExpenseEntryMode('ia')}
                                    className={cn(
                                        "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                                        expenseEntryMode === 'ia' 
                                            ? "bg-background shadow-md text-emerald-500 border border-border/50" 
                                            : "text-muted-foreground hover:bg-muted/60"
                                    )}
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Con IA
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseEntryMode('manual')}
                                    className={cn(
                                        "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                                        expenseEntryMode === 'manual' 
                                            ? "bg-background shadow-md text-foreground border border-border/50" 
                                            : "text-muted-foreground hover:bg-muted/60"
                                    )}
                                >
                                    <PenTool className="w-5 h-5" />
                                    Manual
                                </button>
                            </div>

                            {/* IA Mode Upload Box */}
                            {expenseEntryMode === 'ia' && (
                                <div 
                                    onClick={() => !isScanning && fileInputRef.current?.click()}
                                    className={cn(
                                        "flex flex-col items-center justify-center py-6 sm:py-10 px-4 sm:px-6 border-2 border-dashed rounded-2xl sm:rounded-3xl transition-all text-center animate-in fade-in cursor-pointer group mb-2 text-balance",
                                        isScanning ? "border-emerald-500/50 bg-emerald-500/5 opacity-80" : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-sm"
                                    )}
                                >
                                    {isScanning ? (
                                        <>
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                                            </div>
                                            <h3 className="font-black text-xl text-foreground tracking-tight">Analizando facturas...</h3>
                                            <p className="text-sm text-muted-foreground mt-2">Por favor espera un momento</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20">
                                                <Camera className="w-8 h-8 text-emerald-500" />
                                            </div>
                                            <h3 className="font-black text-xl text-foreground tracking-tight">Escanear Documento</h3>
                                            <p className="text-sm text-muted-foreground mt-2 font-medium">La IA extraerá todos los datos de forma automática.</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Manual entry form (Queue is empty) */}
                            {expenseEntryMode === 'manual' && (
                                <div className="flex flex-col gap-3 pt-1">
                                    {/* Type Selector */}
                                    <div className="relative grid grid-cols-2 gap-0 p-1 rounded-2xl bg-muted/30 border border-border/60 overflow-hidden">
                                        <div
                                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out shadow-md ${
                                                expenseType === 'reinversion'
                                                    ? 'left-1 bg-gradient-to-br from-green-600 to-emerald-500'
                                                    : 'left-[calc(50%+3px)] bg-gradient-to-br from-green-700 to-teal-600'
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleExpenseTypeChange('reinversion')}
                                            className={`relative z-10 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                                                expenseType === 'reinversion' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <span>🔄</span> Reinversión
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExpenseTypeChange('operativo')}
                                            className={`relative z-10 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                                                expenseType === 'operativo' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <span>⚙️</span> Gasto Operativo
                                        </button>
                                    </div>

                                    <p className="-mt-1 text-[11px] text-center font-medium tracking-wide text-green-400">
                                        {expenseType === 'reinversion'
                                            ? '📦 Compra de mercadería / inventario para vender'
                                            : '🏢 Alquiler, nómina, servicios, mantenimiento, etc.'}
                                    </p>

                                    {/* Amount */}
                                    <div className="relative rounded-xl sm:rounded-2xl px-4 py-2.5 sm:py-3 border-2 bg-green-500/5 border-green-500/30">
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-0.5">Monto</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl sm:text-3xl font-black text-green-400">$</span>
                                            <input
                                                id="amount"
                                                type="number"
                                                placeholder="0.00"
                                                step="0.01"
                                                className="flex-1 bg-transparent text-2xl sm:text-3xl font-black text-foreground placeholder:text-muted-foreground/30 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={newExpense.amount || ''}
                                                onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>

                                    {/* Concept + Date */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label htmlFor="description" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <FileText className="h-3 w-3" /> Concepto
                                            </label>
                                            <Input
                                                id="description"
                                                placeholder="Ej. Compra de mercancería"
                                                className="h-9 bg-muted/30 border-border/60 rounded-xl text-sm"
                                                value={newExpense.description || ''}
                                                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label htmlFor="date" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Calendar className="h-3 w-3" /> Fecha
                                            </label>
                                            <Input
                                                id="date"
                                                type="date"
                                                className="h-9 bg-muted/30 border-border/60 rounded-xl font-medium text-sm"
                                                value={newExpense.date && isValid(newExpense.date) ? format(newExpense.date, 'yyyy-MM-dd') : ''}
                                                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value ? new Date(e.target.value) : new Date() })}
                                            />
                                        </div>
                                    </div>

                                    {/* Category pills */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                            <ShoppingCart className="h-3 w-3" /> Categoría
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableCategories.map(cat => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setNewExpense({ ...newExpense, category: cat })}
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
                                                        newExpense.category === cat
                                                            ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-500/30'
                                                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-green-500/40'
                                                    }`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Supplier + Invoice number */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Building2 className="h-3 w-3" /> Proveedor
                                            </label>
                                            <Popover modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between h-10 bg-muted/30 border-border/60 rounded-xl",
                                                            !newExpense.supplier_name && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="truncate">{newExpense.supplier_name || 'Seleccionar...'}</span>
                                                        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[calc(100vw-32px)] sm:w-[280px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar proveedor..." />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="p-2 text-sm text-center">
                                                                    No encontrado. Escribe para crear.
                                                                </div>
                                                            </CommandEmpty>
                                                            <CommandGroup heading="Proveedores Existentes">
                                                                {suppliers.map((supplier) => (
                                                                    <CommandItem
                                                                        key={supplier.id}
                                                                        value={supplier.name}
                                                                        onSelect={(currentValue) => {
                                                                            setNewExpense({ ...newExpense, supplier_name: currentValue });
                                                                        }}
                                                                        className="flex justify-between items-center group w-full"
                                                                    >
                                                                        <div className="flex items-center">
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    newExpense.supplier_name === supplier.name ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {supplier.name}
                                                                        </div>
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteSupplier(supplier.id, supplier.name);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                                        </Button>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                        <div className="p-2 border-t">
                                                            <Input
                                                                placeholder="O escribir nombre nuevo..."
                                                                value={newExpense.supplier_name}
                                                                onChange={(e) => setNewExpense({ ...newExpense, supplier_name: e.target.value })}
                                                                className="h-8"
                                                            />
                                                        </div>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label htmlFor="invoice" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Receipt className="h-3 w-3" /> No. Factura
                                            </label>
                                            <Input
                                                id="invoice"
                                                placeholder="NCF o Referencia"
                                                className="h-9 bg-muted/30 border-border/60 rounded-xl text-sm"
                                                value={newExpense.invoice_number || ''}
                                                onChange={(e) => setNewExpense({ ...newExpense, invoice_number: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Photo upload */}
                                    <div className="flex flex-col gap-1.5 mt-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                            <Camera className="h-3 w-3" /> Foto de Factura / Comprobante
                                        </label>
                                        <input
                                            type="file"
                                            ref={manualFileInputRef}
                                            onChange={handleManualImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        
                                        {isUploadingManualImage ? (
                                            <div className="flex items-center justify-center gap-2 h-14 rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground text-xs font-semibold">
                                                <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                                                <span>Subiendo imagen...</span>
                                            </div>
                                        ) : newExpense.image_url ? (
                                            <div className="relative flex items-center gap-3 p-2 rounded-xl border border-border bg-muted/20">
                                                <div 
                                                    className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/80 w-12 h-12 flex-shrink-0"
                                                    onClick={() => {
                                                        setPreviewImageUrl(newExpense.image_url);
                                                        setPreviewImageScale(1);
                                                        setPreviewImageRotation(0);
                                                        setPreviewImagePosition({ x: 0, y: 0 });
                                                    }}
                                                >
                                                    <img
                                                        src={newExpense.image_url}
                                                        alt="Comprobante"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                                        <Search className="h-4 w-4 text-white" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate text-foreground">Comprobante subido</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">La imagen se guardará con el gasto</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                    onClick={() => setNewExpense(prev => ({ ...prev, image_url: null }))}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => manualFileInputRef.current?.click()}
                                                className="h-14 border-dashed border-border/60 hover:border-green-500/40 bg-muted/10 hover:bg-green-500/5 hover:text-green-400 rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
                                            >
                                                <Upload className="h-4 w-4 text-muted-foreground" />
                                                <div className="text-left">
                                                    <p className="text-xs font-semibold">Subir imagen (Opcional)</p>
                                                    <p className="text-[10px] text-muted-foreground">Formato JPG, PNG (máx. 5MB)</p>
                                                </div>
                                            </Button>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                                        <Button variant="ghost" className="rounded-xl h-10 px-4 text-xs font-semibold" onClick={() => setIsAddExpenseOpen(false)}>Cancelar</Button>
                                        <Button 
                                            onClick={handleAddExpense}
                                            disabled={isCreating}
                                            className="rounded-xl h-10 px-6 font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                                        >
                                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            {expenseType === 'reinversion' ? 'Guardar Reinversión' : 'Guardar Gasto'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Split screen view when files are in the queue */
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 min-h-0 md:min-h-[450px] w-full max-w-full overflow-x-hidden">
                            {/* Left Column: Queue Manager */}
                            <div className="md:col-span-5 flex flex-col gap-4 md:border-r border-b md:border-b-0 border-border/20 pr-0 md:pr-4 pb-4 md:pb-0 w-full max-w-full overflow-x-hidden">
                                <div className="flex justify-between items-center pb-2 border-b">
                                    <h3 className="font-black text-xs uppercase tracking-wider text-muted-foreground">Lista de Facturas</h3>
                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                        {scanQueue.filter(i => i.status === 'saved').length}/{scanQueue.length} Guardadas
                                    </span>
                                </div>
                                
                                {/* Add more invoices button */}
                                <Button 
                                    size="sm"
                                    variant="outline" 
                                    className="w-full h-10 border-dashed border-2 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5 text-emerald-500 font-bold gap-2 rounded-xl text-xs"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isScanning}
                                >
                                    <Plus className="h-4 w-4" /> Agregar más facturas
                                </Button>

                                {/* Scrollable Queue List */}
                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                    {scanQueue.map((item, idx) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => {
                                                if (item.status === 'success' || item.status === 'saved' || item.status === 'error') {
                                                    setReviewIndex(idx);
                                                }
                                            }}
                                            className={cn(
                                                "flex items-center justify-between bg-card p-3 rounded-xl border shadow-sm transition-all duration-200",
                                                (item.status === 'success' || item.status === 'saved' || item.status === 'error') && "cursor-pointer hover:bg-muted/30",
                                                reviewIndex === idx && "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 truncate flex-1 mr-2">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                                                    reviewIndex === idx ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="text-xs font-bold truncate max-w-[140px] text-foreground">
                                                        {item.file.name}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 truncate max-w-[150px]">
                                                        {item.status === 'pending' && "En cola..."}
                                                        {item.status === 'scanning' && (item.statusMessage || "Analizando...")}
                                                        {item.status === 'saved' && "✓ Guardada"}
                                                        {item.status === 'error' && "⚠ Error al procesar"}
                                                        {item.status === 'success' && "Listo para revisar"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-1">
                                                {item.status === 'scanning' && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />}
                                                {item.status === 'saved' && <Check className="h-4 w-4 text-emerald-500 font-bold" />}
                                                {item.status === 'error' && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-full"
                                                            title="Reintentar escaneo"
                                                            disabled={isScanning}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRetrySingleItem(item.id);
                                                            }}
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                                    </div>
                                                )}
                                                {item.status === 'success' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Save All / Actions */}
                                <div className="pt-2 border-t mt-auto flex flex-col gap-2">
                                    {scanQueue.some(i => i.status === 'error') && (
                                        <Button 
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold uppercase tracking-wider text-[10px] h-9 rounded-xl shadow-sm gap-1.5"
                                            onClick={handleRetryFailedItems}
                                            disabled={isScanning}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> Reintentar fallidos ({scanQueue.filter(i => i.status === 'error').length})
                                        </Button>
                                    )}
                                    {scanQueue.some(i => i.status === 'success') && (
                                        <Button 
                                            size="sm"
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-[10px] h-9 rounded-xl shadow-md gap-1.5"
                                            onClick={handleSaveAllReady}
                                            disabled={isScanning}
                                        >
                                            <CheckCheck className="h-4 w-4" /> Guardar todo listo
                                        </Button>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 text-xs h-9 rounded-xl font-semibold"
                                            onClick={() => {
                                                setIsAddExpenseOpen(false);
                                                setScanQueue([]);
                                            }}
                                        >
                                            Cerrar Ventana
                                        </Button>
                                        <Button 
                                            size="sm"
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isScanning}
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Escanear otra
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right Column: Review Details Form */}
                            <div className="md:col-span-7 flex flex-col justify-center w-full max-w-full overflow-x-hidden pt-4 md:pt-0">
                                {scanQueue[reviewIndex]?.status === 'scanning' ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-center p-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center animate-pulse">
                                            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground">Analizando factura con IA...</p>
                                        <p className="text-xs text-muted-foreground max-w-xs">
                                            {scanQueue[reviewIndex]?.statusMessage || "La IA de Groq está leyendo los datos del comprobante."}
                                        </p>
                                    </div>
                                ) : scanQueue[reviewIndex]?.status === 'pending' ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-center text-muted-foreground">
                                        <Clock className="h-8 w-8 animate-pulse text-emerald-500" />
                                        <p className="text-sm font-semibold">En cola de procesamiento</p>
                                        <p className="text-xs">Se iniciará el escaneo automáticamente en unos momentos.</p>
                                    </div>
                                ) : (
                                    /* Form for success/error/saved */
                                    <div className="flex flex-col gap-3">
                                        {scanQueue[reviewIndex]?.status === 'error' && (
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-foreground">No se pudo escanear automáticamente</p>
                                                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
                                                            {scanQueue[reviewIndex]?.error || "Ocurrió un error en el escaneo."}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        type="button"
                                                        className="h-7 text-[11px] font-bold border-red-500/40 text-red-400 hover:bg-red-500/20 gap-1 rounded-lg"
                                                        onClick={() => handleRetrySingleItem(scanQueue[reviewIndex].id)}
                                                        disabled={isScanning}
                                                    >
                                                        <RefreshCw className="h-3 w-3" /> Reintentar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {scanQueue[reviewIndex]?.status === 'saved' && (
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Check className="h-4 w-4 shrink-0 text-emerald-400 font-bold" />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-foreground">Factura registrada exitosamente</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            Este comprobante ya fue guardado en la contabilidad.
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    type="button"
                                                    className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 gap-1.5 rounded-lg shadow-sm"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isScanning}
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Escanear otra
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pb-1 border-b border-border/30">
                                            <h4 className="font-black text-xs uppercase tracking-wider text-muted-foreground">Datos del Gasto Seleccionado</h4>
                                            <div className="flex items-center gap-2">
                                                {newExpense.image_url && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2 rounded-lg gap-1"
                                                        onClick={() => {
                                                            setPreviewImageUrl(newExpense.image_url);
                                                            setPreviewImageScale(1);
                                                            setPreviewImageRotation(0);
                                                            setPreviewImagePosition({ x: 0, y: 0 });
                                                        }}
                                                    >
                                                        <Eye className="h-3 w-3" /> Ver Foto Ampliada
                                                    </Button>
                                                )}
                                                <span className="text-[10px] font-bold text-muted-foreground max-w-[150px] truncate">
                                                    {scanQueue[reviewIndex]?.file.name}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Type Selector */}
                                        <div className="relative grid grid-cols-2 gap-0 p-1 rounded-2xl bg-muted/30 border border-border/60 overflow-hidden">
                                            <div
                                                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out shadow-md ${
                                                    expenseType === 'reinversion'
                                                        ? 'left-1 bg-gradient-to-br from-green-600 to-emerald-500'
                                                        : 'left-[calc(50%+3px)] bg-gradient-to-br from-green-700 to-teal-600'
                                                }`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleExpenseTypeChange('reinversion')}
                                                className={`relative z-10 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                                                    expenseType === 'reinversion' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                <span>🔄</span> Reinversión
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleExpenseTypeChange('operativo')}
                                                className={`relative z-10 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                                                    expenseType === 'operativo' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                <span>⚙️</span> Gasto Operativo
                                            </button>
                                        </div>

                                        <p className="-mt-1 text-[11px] text-center font-medium tracking-wide text-green-400">
                                            {expenseType === 'reinversion'
                                                ? '📦 Compra de mercadería / inventario para vender'
                                                : '🏢 Alquiler, nómina, servicios, mantenimiento, etc.'}
                                        </p>

                                        {/* Amount */}
                                        <div className="relative rounded-xl sm:rounded-2xl px-4 py-2.5 sm:py-3 border-2 bg-green-500/5 border-green-500/30">
                                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-0.5">Monto</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl sm:text-3xl font-black text-green-400">$</span>
                                                <input
                                                    id="amount"
                                                    type="number"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                    className="flex-1 bg-transparent text-2xl sm:text-3xl font-black text-foreground placeholder:text-muted-foreground/30 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    value={newExpense.amount || ''}
                                                    onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                                                />
                                            </div>
                                        </div>

                                        {/* Concept + Date */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label htmlFor="description" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> Concepto
                                                </label>
                                                <Input
                                                    id="description"
                                                    placeholder="Ej. Compra de mercancería"
                                                    className="h-9 bg-muted/30 border-border/60 rounded-xl text-sm"
                                                    value={newExpense.description || ''}
                                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label htmlFor="date" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> Fecha
                                                </label>
                                                <Input
                                                    id="date"
                                                    type="date"
                                                    className="h-9 bg-muted/30 border-border/60 rounded-xl font-medium text-sm"
                                                    value={newExpense.date && isValid(newExpense.date) ? format(newExpense.date, 'yyyy-MM-dd') : ''}
                                                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value ? new Date(e.target.value) : new Date() })}
                                                />
                                            </div>
                                        </div>

                                        {/* Category pills */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <ShoppingCart className="h-3 w-3" /> Categoría
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {availableCategories.map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setNewExpense({ ...newExpense, category: cat })}
                                                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
                                                            newExpense.category === cat
                                                                ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-500/30'
                                                                : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-green-500/40'
                                                        }`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Supplier + Invoice number */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    <Building2 className="h-3 w-3" /> Proveedor
                                                </label>
                                                <Popover modal={true}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between h-10 bg-muted/30 border-border/60 rounded-xl",
                                                                !newExpense.supplier_name && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <span className="truncate">{newExpense.supplier_name || 'Seleccionar...'}</span>
                                                            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[calc(100vw-32px)] sm:w-[280px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar proveedor..." />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <div className="p-2 text-sm text-center">
                                                                        No encontrado. Escribe para crear.
                                                                    </div>
                                                                </CommandEmpty>
                                                                <CommandGroup heading="Proveedores Existentes">
                                                                    {suppliers.map((supplier) => (
                                                                        <CommandItem
                                                                            key={supplier.id}
                                                                            value={supplier.name}
                                                                            onSelect={(currentValue) => {
                                                                                setNewExpense({ ...newExpense, supplier_name: currentValue });
                                                                            }}
                                                                            className="flex justify-between items-center group w-full"
                                                                        >
                                                                            <div className="flex items-center">
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        newExpense.supplier_name === supplier.name ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {supplier.name}
                                                                            </div>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteSupplier(supplier.id, supplier.name);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                                            </Button>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                            <div className="p-2 border-t">
                                                                <Input
                                                                    placeholder="O escribir nombre nuevo..."
                                                                    value={newExpense.supplier_name}
                                                                    onChange={(e) => setNewExpense({ ...newExpense, supplier_name: e.target.value })}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label htmlFor="invoice" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    <Receipt className="h-3 w-3" /> No. Factura
                                                </label>
                                                <Input
                                                    id="invoice"
                                                    placeholder="NCF o Referencia"
                                                    className="h-9 bg-muted/30 border-border/60 rounded-xl text-sm"
                                                    value={newExpense.invoice_number || ''}
                                                    onChange={(e) => setNewExpense({ ...newExpense, invoice_number: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Photo upload / image preview */}
                                        <div className="flex flex-col gap-1.5 mt-1">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Camera className="h-3 w-3" /> Foto de Factura / Comprobante
                                            </label>
                                            <input
                                                type="file"
                                                ref={manualFileInputRef}
                                                onChange={handleManualImageUpload}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            
                                            {isUploadingManualImage ? (
                                                <div className="flex items-center justify-center gap-2 h-14 rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground text-xs font-semibold">
                                                    <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                                                    <span>Subiendo imagen...</span>
                                                </div>
                                            ) : newExpense.image_url ? (
                                                <div className="relative flex items-center gap-3 p-2 rounded-xl border border-border bg-muted/20">
                                                    <div 
                                                     className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/80 w-12 h-12 flex-shrink-0"
                                                     onClick={() => {
                                                         setPreviewImageUrl(newExpense.image_url);
                                                         setPreviewImageScale(1);
                                                         setPreviewImageRotation(0);
                                                         setPreviewImagePosition({ x: 0, y: 0 });
                                                     }}
                                                 >
                                                     <img
                                                         src={newExpense.image_url}
                                                         alt="Comprobante"
                                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                     />
                                                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                                         <Search className="h-4 w-4 text-white" />
                                                     </div>
                                                 </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate text-foreground">Comprobante subido</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">La imagen se guardará con el gasto</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                        onClick={() => setNewExpense(prev => ({ ...prev, image_url: null }))}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => manualFileInputRef.current?.click()}
                                                    className="h-14 border-dashed border-border/60 hover:border-green-500/40 bg-muted/10 hover:bg-green-500/5 hover:text-green-400 rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
                                                >
                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                    <div className="text-left">
                                                        <p className="text-xs font-semibold">Subir imagen (Opcional)</p>
                                                        <p className="text-[10px] text-muted-foreground">Formato JPG, PNG (máx. 5MB)</p>
                                                    </div>
                                                </Button>
                                            )}
                                        </div>

                                        {/* Action buttons inside form */}
                                        <div className="flex justify-between items-center gap-2 mt-4 pt-2 border-t border-border/30">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-xs rounded-xl"
                                                onClick={handleSkipItem}
                                            >
                                                Omitir factura
                                            </Button>
                                            
                                            {scanQueue[reviewIndex]?.status === 'saved' ? (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-xs font-bold text-emerald-500 flex items-center gap-1.5 shadow-sm">
                                                        <Check className="h-4 w-4" /> Registrado
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        type="button"
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 h-9 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isScanning}
                                                    >
                                                        <Plus className="h-4 w-4" /> Escanear otra factura
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button 
                                                    size="sm"
                                                    disabled={isCreating}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs px-6 h-9 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                                                    onClick={handleAddExpense}
                                                >
                                                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    {isCreating ? "Guardando..." : "Registrar Gasto"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog: Add / Edit Supplier */}
            <Dialog open={isAddSupplierOpen} onOpenChange={(open) => {
                setIsAddSupplierOpen(open);
                if (!open) setEditingSupplier(null);
            }}>
                <DialogContent className="sm:max-w-[500px] rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Building2 className="h-5 w-5 text-primary" />
                            {editingSupplier ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingSupplier
                                ? 'Actualiza los datos de contacto, pagos y cuenta bancaria del proveedor.'
                                : 'Agrega un nuevo proveedor con sus datos de contacto y cuenta para transferencias.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        {/* RNC con búsqueda DGII */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-3 sm:items-center">
                            <Label htmlFor="sup-rnc" className="sm:text-right text-xs font-bold">RNC / Cédula</Label>
                            <div className="sm:col-span-3 relative flex items-center">
                                <Input
                                    id="sup-rnc"
                                    placeholder="000-00000-0"
                                    className="pr-10 h-9 rounded-xl text-sm"
                                    value={newSupplier.rnc || ''}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, rnc: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 w-7 h-7 text-muted-foreground hover:text-foreground"
                                    onClick={handleLookupSupplierRnc}
                                    disabled={isLookingUpSupplierRnc || !newSupplier.rnc}
                                    title="Buscar RNC en DGII"
                                >
                                    {isLookingUpSupplierRnc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        {/* Nombre */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-3 sm:items-center">
                            <Label htmlFor="sup-name" className="sm:text-right text-xs font-bold">Nombre *</Label>
                            <Input
                                id="sup-name"
                                placeholder="Ej. Distribuidora Banileja"
                                className="sm:col-span-3 h-9 rounded-xl text-sm"
                                value={newSupplier.name || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                            />
                        </div>

                        {/* Teléfono & Contacto */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-3 sm:items-center">
                            <Label htmlFor="sup-phone" className="sm:text-right text-xs font-bold">Teléfono</Label>
                            <Input
                                id="sup-phone"
                                placeholder="Ej. 809-555-0199"
                                className="sm:col-span-3 h-9 rounded-xl text-sm"
                                value={newSupplier.phone || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-3 sm:items-center">
                            <Label htmlFor="sup-contact" className="sm:text-right text-xs font-bold">Contacto / Email</Label>
                            <Input
                                id="sup-contact"
                                placeholder="Persona de contacto o Email"
                                className="sm:col-span-3 h-9 rounded-xl text-sm"
                                value={newSupplier.contact || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                            />
                        </div>

                        <div className="my-1 border-t border-border/40" />

                        {/* Método de Pago Preferido */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-3 sm:items-center">
                            <Label className="sm:text-right text-xs font-bold">Pago Preferido</Label>
                            <div className="sm:col-span-3 flex gap-2">
                                <Button
                                    type="button"
                                    variant={newSupplier.payment_method === 'transfer' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 h-9 text-xs font-bold rounded-xl gap-1.5"
                                    onClick={() => setNewSupplier({ ...newSupplier, payment_method: 'transfer' })}
                                >
                                    <Landmark className="h-3.5 w-3.5" /> Transferencia
                                </Button>
                                <Button
                                    type="button"
                                    variant={newSupplier.payment_method === 'cash' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 h-9 text-xs font-bold rounded-xl gap-1.5"
                                    onClick={() => setNewSupplier({ ...newSupplier, payment_method: 'cash' })}
                                >
                                    <DollarSign className="h-3.5 w-3.5" /> Efectivo
                                </Button>
                            </div>
                        </div>

                        {/* Campos Bancarios */}
                        <div className="space-y-3 bg-muted/20 p-3 rounded-xl border border-border/40">
                            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Landmark className="h-3.5 w-3.5 text-primary" /> Datos Bancarios para Transferencia
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 sm:items-center">
                                <Label className="text-xs font-medium">Banco</Label>
                                <div className="sm:col-span-2">
                                    <Input
                                        placeholder="Ej. Banco Popular, Banreservas, BHD"
                                        className="h-8 rounded-lg text-xs"
                                        value={newSupplier.bank_name || ''}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, bank_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 sm:items-center">
                                <Label className="text-xs font-medium">Número Cuenta</Label>
                                <div className="sm:col-span-2">
                                    <Input
                                        placeholder="Ej. 123456789"
                                        className="h-8 rounded-lg text-xs font-mono"
                                        value={newSupplier.bank_account_number || ''}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, bank_account_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 sm:items-center">
                                <Label className="text-xs font-medium">Tipo de Cuenta</Label>
                                <div className="sm:col-span-2">
                                    <Select
                                        value={newSupplier.bank_account_type || 'ahorros'}
                                        onValueChange={(val) => setNewSupplier({ ...newSupplier, bank_account_type: val })}
                                    >
                                        <SelectTrigger className="h-8 text-xs rounded-lg bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="ahorros" className="text-xs">Cuenta de Ahorros</SelectItem>
                                            <SelectItem value="corriente" className="text-xs">Cuenta Corriente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsAddSupplierOpen(false)} className="rounded-xl h-9 text-xs font-bold">
                            Cancelar
                        </Button>
                        <Button onClick={handleAddSupplier} className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground">
                            {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Expense Details & Editing */}
            <Dialog open={isDetailsOpen} onOpenChange={(open) => {
                setIsDetailsOpen(open);
                if (!open) setIsEditingExpenseDetails(false);
            }}>
                <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden bg-card border border-border/60 rounded-3xl max-h-[90dvh] flex flex-col">
                    <DialogHeader className="p-4 sm:p-6 pb-4 border-b border-border/30 bg-muted/20 pr-12 shrink-0">
                        <div className="flex flex-col gap-1 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                    <span>{isEditingExpenseDetails ? "✏️ Editar Gasto" : "📄 Detalle del Gasto"}</span>
                                </DialogTitle>
                                {!isEditingExpenseDetails && selectedExpenseForDetails?.category && (
                                    <span className={`px-2.5 py-0.5 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                                        isReinvestment(selectedExpenseForDetails.category)
                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                    }`}>
                                        {selectedExpenseForDetails.category}
                                    </span>
                                )}
                            </div>
                            <DialogDescription className="text-xs font-semibold text-muted-foreground">
                                {isEditingExpenseDetails ? "Modifica los campos del comprobante de gasto" : "Información del comprobante de compra"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    
                    {isEditingExpenseDetails ? (
                        /* EDIT MODE FORM */
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90dvh-130px)] flex-1">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Concepto / Descripción *
                                </Label>
                                <Input
                                    value={editExpenseForm.description}
                                    onChange={(e) => setEditExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ej. Compra de mercancía"
                                    className="rounded-xl font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Monto ($) *
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editExpenseForm.amount}
                                        onChange={(e) => setEditExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="0.00"
                                        className="rounded-xl font-bold text-green-400"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Categoría
                                    </Label>
                                    <Select
                                        value={editExpenseForm.category}
                                        onValueChange={(val) => setEditExpenseForm(prev => ({ ...prev, category: val }))}
                                    >
                                        <SelectTrigger className="rounded-xl font-semibold">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Inventario">Inventario</SelectItem>
                                            <SelectItem value="Servicios Públicos">Servicios Públicos</SelectItem>
                                            <SelectItem value="Alquiler">Alquiler</SelectItem>
                                            <SelectItem value="Nómina">Nómina</SelectItem>
                                            <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                                            <SelectItem value="Marketing">Marketing</SelectItem>
                                            <SelectItem value="Impuestos">Impuestos</SelectItem>
                                            <SelectItem value="Otros">Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Proveedor
                                    </Label>
                                    <Input
                                        value={editExpenseForm.supplier_name}
                                        onChange={(e) => setEditExpenseForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                                        placeholder="Nombre del proveedor"
                                        className="rounded-xl font-semibold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Fecha Transacción
                                    </Label>
                                    <Input
                                        type="date"
                                        value={editExpenseForm.date}
                                        onChange={(e) => setEditExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="rounded-xl font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                    No. Factura / Comprobante (NCF)
                                </Label>
                                <Input
                                    value={editExpenseForm.invoice_number}
                                    onChange={(e) => setEditExpenseForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                                    placeholder="Ej. B0100000001"
                                    className="rounded-xl font-semibold"
                                />
                            </div>

                            {/* Image Edit Section */}
                            <div className="space-y-2 pt-2 border-t border-border/20">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    <Camera className="h-3.5 w-3.5" /> Factura Adjunta
                                </Label>

                                <input
                                    type="file"
                                    ref={editFileInputRef}
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={handleUploadEditImage}
                                />

                                {editExpenseForm.image_url ? (
                                    <div className="relative rounded-2xl overflow-hidden border border-border/60 max-h-[180px] bg-muted/10 group">
                                        <img
                                            src={editExpenseForm.image_url}
                                            alt="Factura adjunta"
                                            className="w-full max-h-[180px] object-contain mx-auto"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => editFileInputRef.current?.click()}
                                                disabled={isUploadingEditImage}
                                                className="rounded-xl text-xs font-bold"
                                            >
                                                {isUploadingEditImage ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                                                Cambiar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => setEditExpenseForm(prev => ({ ...prev, image_url: null }))}
                                                className="rounded-xl text-xs font-bold"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-dashed border-border/60 rounded-2xl py-6 flex flex-col items-center gap-1.5 hover:bg-muted/10"
                                        onClick={() => editFileInputRef.current?.click()}
                                        disabled={isUploadingEditImage}
                                    >
                                        {isUploadingEditImage ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                                        ) : (
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                        )}
                                        <span className="text-xs font-bold">
                                            {isUploadingEditImage ? "Subiendo imagen..." : "Subir o cambiar comprobante"}
                                        </span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* READ-ONLY VIEW MODE */
                        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90dvh-130px)] flex-1">
                            {/* Summary details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Concepto</span>
                                    <p className="text-sm font-bold text-foreground truncate">{selectedExpenseForDetails?.description}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monto</span>
                                    <p className="text-lg font-black text-green-400">${(selectedExpenseForDetails?.amount || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <Building2 className="h-3 w-3" /> Proveedor
                                    </span>
                                    <p className="text-xs font-semibold text-foreground">{selectedExpenseForDetails?.supplier_name || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Fecha de Transacción
                                    </span>
                                    <p className="text-xs font-semibold text-foreground">
                                        {selectedExpenseForDetails?.date && isValid(new Date(selectedExpenseForDetails.date))
                                            ? format(new Date(selectedExpenseForDetails.date), 'dd/MM/yyyy')
                                            : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <Receipt className="h-3 w-3" /> No. Factura
                                    </span>
                                    <p className="text-xs font-semibold text-foreground">{selectedExpenseForDetails?.invoice_number || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fecha Registro</span>
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {selectedExpenseForDetails?.created_at && isValid(new Date(selectedExpenseForDetails.created_at))
                                            ? format(new Date(selectedExpenseForDetails.created_at), 'dd/MM/yyyy HH:mm')
                                            : '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Invoice Image preview */}
                            <div className="space-y-2 pt-4 border-t border-border/20">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    <Camera className="h-3 w-3" /> Factura Adjunta
                                </span>
                                
                                {selectedExpenseForDetails?.image_url ? (
                                    <div className="space-y-3">
                                        <div 
                                            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-muted/10 max-h-[260px]"
                                            onClick={() => {
                                                setPreviewImageUrl(selectedExpenseForDetails.image_url);
                                                setPreviewImageScale(1);
                                                setPreviewImageRotation(0);
                                                setPreviewImagePosition({ x: 0, y: 0 });
                                            }}
                                        >
                                            <img
                                                src={selectedExpenseForDetails.image_url}
                                                alt="Factura / Comprobante"
                                                className="w-full max-h-[260px] object-contain mx-auto rounded-2xl group-hover:scale-[1.02] transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                                <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                                                    <Search className="h-3.5 w-3.5" />
                                                    <span>Click para Zoom</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-center">
                                            <a
                                                href={selectedExpenseForDetails.image_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-2 rounded-xl bg-muted/35 text-foreground border border-border/50 text-xs font-bold hover:bg-muted/50 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>Ver Completa</span>
                                            </a>
                                            <Button
                                                type="button"
                                                onClick={() => handleDownloadImage(
                                                    selectedExpenseForDetails.image_url!,
                                                    `factura-${selectedExpenseForDetails.invoice_number || selectedExpenseForDetails.id.slice(0,8)}.jpg`
                                                )}
                                                className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                <span>Descargar</span>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-border/60 bg-muted/5 text-center text-muted-foreground">
                                        <Receipt className="h-6 w-6 mb-2 text-muted-foreground/40" />
                                        <p className="text-xs font-semibold">No hay imagen adjunta</p>
                                        <p className="text-[10px] text-muted-foreground/60">Este gasto se registró sin imagen de comprobante</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter className="p-4 border-t border-border/30 bg-muted/10 flex flex-row items-center justify-between gap-2 shrink-0">
                        {isEditingExpenseDetails ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditingExpenseDetails(false)}
                                    className="font-bold rounded-xl text-xs"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSaveEditedExpense}
                                    disabled={isUpdatingExpense}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs px-5 flex items-center gap-1.5"
                                >
                                    {isUpdatingExpense ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    <span>Guardar Cambios</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDeleteExpenseFromDetails}
                                        className="border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl font-bold text-xs"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => selectedExpenseForDetails && handleStartEditExpense(selectedExpenseForDetails)}
                                        className="border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-xl font-bold text-xs"
                                    >
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar Gasto
                                    </Button>
                                </div>
                                <Button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="font-bold rounded-xl px-5 text-xs"
                                >
                                    Cerrar
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Add/Edit Fixed Expense */}
            <Dialog open={isAddFixedOpen} onOpenChange={setIsAddFixedOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/50 max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-left">
                            {editingFixed ? "Editar Gasto Fijo" : "Registrar Gasto Fijo Mensual"}
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Define un gasto fijo que se repita todos los meses de forma automática.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="fixed-desc" className="text-xs font-bold text-muted-foreground uppercase">Concepto / Descripción</Label>
                            <Input
                                id="fixed-desc"
                                placeholder="Ej. Alquiler Local, Internet, Luz"
                                className="h-10 rounded-xl"
                                value={fixedForm.description}
                                onChange={(e) => setFixedForm({ ...fixedForm, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2 text-left">
                                <Label htmlFor="fixed-amount" className="text-xs font-bold text-muted-foreground uppercase">Monto Mensual</Label>
                                <Input
                                    id="fixed-amount"
                                    type="number"
                                    placeholder="0.00"
                                    className="h-10 rounded-xl"
                                    value={fixedForm.amount}
                                    onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2 text-left">
                                <Label htmlFor="fixed-due" className="text-xs font-bold text-muted-foreground uppercase">Día de Pago</Label>
                                <Input
                                    id="fixed-due"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="Día 1-31"
                                    className="h-10 rounded-xl"
                                    value={fixedForm.due_day}
                                    onChange={(e) => setFixedForm({ ...fixedForm, due_day: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 text-left">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Categoría</Label>
                            <Select
                                value={fixedForm.category}
                                onValueChange={(val) => setFixedForm({ ...fixedForm, category: val })}
                            >
                                <SelectTrigger className="h-10 rounded-xl bg-background border border-input">
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {CATEGORIES.filter(c => c !== 'Inventario').map((cat) => (
                                        <SelectItem key={cat} value={cat} className="rounded-lg">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="rounded-xl" onClick={() => setIsAddFixedOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 font-bold animate-in duration-200 active:scale-95"
                            onClick={handleSaveFixedExpense}
                        >
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Registrar Deuda */}
            <Dialog open={isAddDebtOpen} onOpenChange={setIsAddDebtOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/50 max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-left flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Registrar Deuda con Proveedor
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Agrega una nueva cuenta por pagar a {selectedSupplierForDebt?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="debt-desc" className="text-xs font-bold text-muted-foreground uppercase">Concepto / Descripción</Label>
                            <Input
                                id="debt-desc"
                                placeholder="Ej. Compra de empaques, mercancía a crédito"
                                className="h-10 rounded-xl"
                                value={debtForm.description}
                                onChange={(e) => setDebtForm({ ...debtForm, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2 text-left">
                                <Label htmlFor="debt-amount" className="text-xs font-bold text-muted-foreground uppercase">Monto de la Deuda</Label>
                                <Input
                                    id="debt-amount"
                                    type="number"
                                    placeholder="0.00"
                                    className="h-10 rounded-xl"
                                    value={debtForm.amount}
                                    onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2 text-left">
                                <Label htmlFor="debt-due" className="text-xs font-bold text-muted-foreground uppercase">Vencimiento (Opcional)</Label>
                                <Input
                                    id="debt-due"
                                    type="date"
                                    className="h-10 rounded-xl"
                                    value={debtForm.due_date}
                                    onChange={(e) => setDebtForm({ ...debtForm, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 text-left">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Categoría de Gasto Asociado</Label>
                            <Select
                                value={debtForm.category}
                                onValueChange={(val) => setDebtForm({ ...debtForm, category: val })}
                            >
                                <SelectTrigger className="h-10 rounded-xl bg-background border border-input">
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat} className="rounded-lg">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="rounded-xl" onClick={() => setIsAddDebtOpen(false)}>
                            Cancelar
                        </Button>
                        <Button className="rounded-xl px-5" onClick={handleRegisterDebt} disabled={isCreatingSupplierDebt}>
                            {isCreatingSupplierDebt ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                                </>
                            ) : (
                                "Guardar Deuda"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Ficha Completa y Detalles del Proveedor */}
            <Dialog open={isViewDebtsOpen} onOpenChange={setIsViewDebtsOpen}>
                <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto rounded-3xl border border-border/50 p-0 overflow-hidden bg-background">
                    {selectedSupplierForView && (() => {
                        const supplier = selectedSupplierForView;
                        const outstanding = getSupplierOutstandingDebt(supplier.id);
                        const hasDebt = outstanding > 0;
                        const debts = supplierDebts.filter(d => d.supplier_id === supplier.id);
                        const isTransfer = (supplier.payment_method || 'transfer') === 'transfer';

                        return (
                            <div className="flex flex-col">
                                {/* Header Ficha */}
                                <div className="p-6 bg-muted/30 border-b border-border/40">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                                                hasDebt ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                            }`}>
                                                {supplier.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-xl font-black text-foreground">{supplier.name}</h2>
                                                    {isTransfer ? (
                                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                            💳 Transferencia
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                            💵 Efectivo
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                                                    <span>RNC / Cédula: <strong className="font-mono text-foreground">{supplier.rnc || 'N/A'}</strong></span>
                                                    <span>•</span>
                                                    <span>Estado: {hasDebt ? <span className="text-red-500 font-bold">Deuda de ${outstanding.toLocaleString()}</span> : <span className="text-emerald-500 font-bold">Sin deuda</span>}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5"
                                                onClick={() => {
                                                    setIsViewDebtsOpen(false);
                                                    handleOpenEditSupplier(supplier);
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5 text-amber-500" />
                                                Editar
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-9 px-4 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5"
                                                onClick={() => {
                                                    setSelectedSupplierForDebt(supplier);
                                                    setDebtForm({ amount: '', description: '', category: 'Inventario', due_date: '' });
                                                    setIsAddDebtOpen(true);
                                                }}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                + Deuda
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Secciones de Información */}
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Tarjeta: Contacto */}
                                        <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Phone className="h-3.5 w-3.5 text-primary" /> Contacto Directo
                                            </h4>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground font-medium">Teléfono:</span>
                                                    {supplier.phone ? (
                                                        <a href={`tel:${supplier.phone}`} className="font-bold text-primary hover:underline flex items-center gap-1 font-mono">
                                                            {supplier.phone}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">No registrado</span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground font-medium">Persona / Email:</span>
                                                    <span className="font-semibold text-foreground">{supplier.contact || 'No registrado'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tarjeta: Datos Bancarios */}
                                        <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    <Landmark className="h-3.5 w-3.5 text-primary" /> Cuenta Bancaria
                                                </h4>
                                                {supplier.bank_account_number && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md gap-1"
                                                        onClick={() => handleCopyAccount(supplier.bank_account_number!)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                        Copiar Cuenta
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground font-medium">Banco:</span>
                                                    <span className="font-bold text-foreground">{supplier.bank_name || 'No especificado'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground font-medium">Número de Cuenta:</span>
                                                    <span className="font-mono font-bold text-foreground text-xs bg-background px-2 py-0.5 rounded-md border border-border/40">
                                                        {supplier.bank_account_number || 'No especificado'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground font-medium">Tipo de Cuenta:</span>
                                                    <span className="font-semibold text-foreground capitalize">
                                                        {supplier.bank_account_type ? `Cuenta de ${supplier.bank_account_type}` : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cuentas por Pagar / Historial */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Receipt className="h-3.5 w-3.5 text-primary" /> Historial de Cuentas por Pagar ({debts.length})
                                        </h4>

                                        {debts.length === 0 ? (
                                            <div className="text-center py-6 text-muted-foreground text-xs bg-muted/10 rounded-2xl border border-border/30">
                                                No hay deudas registradas con este proveedor.
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/20">
                                                            <TableHead className="text-xs font-bold">Concepto</TableHead>
                                                            <TableHead className="text-right text-xs font-bold">Total</TableHead>
                                                            <TableHead className="text-right text-xs font-bold">Pagado</TableHead>
                                                            <TableHead className="text-right text-xs font-bold">Pendiente</TableHead>
                                                            <TableHead className="text-center text-xs font-bold">Estado</TableHead>
                                                            <TableHead className="text-right text-xs font-bold">Acción</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {debts.map((debt) => {
                                                            const remaining = Number(debt.amount) - Number(debt.amount_paid);
                                                            return (
                                                                <TableRow key={debt.id}>
                                                                    <TableCell className="font-medium text-xs">
                                                                        <div>{debt.description}</div>
                                                                        <div className="text-[10px] text-muted-foreground">{debt.category}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs font-semibold">${Number(debt.amount).toLocaleString()}</TableCell>
                                                                    <TableCell className="text-right text-xs text-emerald-500">${Number(debt.amount_paid).toLocaleString()}</TableCell>
                                                                    <TableCell className="text-right text-xs text-red-500 font-bold">${remaining.toLocaleString()}</TableCell>
                                                                    <TableCell className="text-center text-xs">
                                                                        {debt.status === 'paid' && (
                                                                            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500">Pagado</span>
                                                                        )}
                                                                        {debt.status === 'partial' && (
                                                                            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500">Parcial</span>
                                                                        )}
                                                                        {debt.status === 'pending' && (
                                                                            <span className="px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-500">Pendiente</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex justify-end items-center gap-1">
                                                                            {debt.status !== 'paid' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-7 px-2 text-[11px] font-bold rounded-lg"
                                                                                    onClick={() => {
                                                                                        setSelectedDebtForPayment(debt);
                                                                                        setPayDebtForm({
                                                                                            amountToPay: remaining.toString(),
                                                                                            category: debt.category,
                                                                                            description: `Abono Deuda: ${debt.description}`
                                                                                        });
                                                                                        setIsPayDebtOpen(true);
                                                                                    }}
                                                                                >
                                                                                    Abonar
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                onClick={() => handleDeleteDebt(debt.id, debt.description)}
                                                                                disabled={isDeletingSupplierDebt}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
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
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Dialog: Registrar Pago / Abono a Deuda */}
            <Dialog open={isPayDebtOpen} onOpenChange={setIsPayDebtOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl border border-border/50 max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-left flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-emerald-500" />
                            Registrar Abono / Pago
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Registra un pago para la deudade "{selectedDebtForPayment?.description}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2 text-left">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Pagos Pendientes</Label>
                            <div className="text-lg font-black text-red-500 bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10">
                                ${selectedDebtForPayment ? (Number(selectedDebtForPayment.amount) - Number(selectedDebtForPayment.amount_paid)).toLocaleString() : '0.00'}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="pay-amount" className="text-xs font-bold text-muted-foreground uppercase">Monto a Abonar</Label>
                            <Input
                                id="pay-amount"
                                type="number"
                                placeholder="0.00"
                                className="h-10 rounded-xl"
                                value={payDebtForm.amountToPay}
                                onChange={(e) => setPayDebtForm({ ...payDebtForm, amountToPay: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="pay-desc" className="text-xs font-bold text-muted-foreground uppercase">Descripción del Egreso</Label>
                            <Input
                                id="pay-desc"
                                placeholder="Ej. Pago con transferencia, abono en efectivo"
                                className="h-10 rounded-xl"
                                value={payDebtForm.description}
                                onChange={(e) => setPayDebtForm({ ...payDebtForm, description: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-2 text-left">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Categoría del Egreso</Label>
                            <Select
                                value={payDebtForm.category}
                                onValueChange={(val) => setPayDebtForm({ ...payDebtForm, category: val })}
                            >
                                <SelectTrigger className="h-10 rounded-xl bg-background border border-input">
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat} className="rounded-lg">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="rounded-xl" onClick={() => setIsPayDebtOpen(false)}>
                            Cancelar
                        </Button>
                        <Button className="rounded-xl px-5 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handlePayDebt} disabled={isPayingSupplierDebt}>
                            {isPayingSupplierDebt ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                                </>
                            ) : (
                                "Registrar Pago"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Interactive Zoomable Receipt Lightbox */}
            <Dialog open={!!previewImageUrl} onOpenChange={(open) => {
                if (!open) setPreviewImageUrl(null);
            }}>
                <DialogContent className="max-w-[100vw] w-screen h-screen p-0 m-0 border-none rounded-none bg-black/95 text-white flex flex-col select-none z-[150] gap-0 [&>button]:hidden animate-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Vista Previa de Comprobante</DialogTitle>
                        <DialogDescription>Visualizador interactivo de imagen de comprobante o factura</DialogDescription>
                    </DialogHeader>
                    {/* Control Bar */}
                    <div className="flex items-center justify-between p-4 bg-black/35 border-b border-white/10 text-white z-10">
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-semibold text-white/90">Vista Previa de Comprobante</span>
                            <span className="text-[10px] text-white/50">Arrastra para mover • Rueda del mouse para zoom</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
                                onClick={handleZoomOut}
                                title="Alejar (Zoom Out)"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            
                            <span className="text-xs font-bold w-12 text-center text-white/80">
                                {Math.round(previewImageScale * 100)}%
                            </span>
                            
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
                                onClick={handleZoomIn}
                                title="Acercar (Zoom In)"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>

                            <div className="h-4 w-[1px] bg-white/10 mx-1" />

                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
                                onClick={handleRotate}
                                title="Rotar 90°"
                            >
                                <RotateCw className="h-4 w-4" />
                            </Button>

                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
                                onClick={handleResetZoom}
                                title="Restablecer"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>

                            <div className="h-4 w-[1px] bg-white/10 mx-1" />

                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-xl ml-2"
                                onClick={() => setPreviewImageUrl(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Image Viewer Body */}
                    <div
                        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-black/40"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        <img
                            src={previewImageUrl || ''}
                            alt="Vista previa de factura"
                            style={{
                                transform: `translate(${previewImagePosition.x}px, ${previewImagePosition.y}px) scale(${previewImageScale}) rotate(${previewImageRotation}deg)`,
                                transition: isDraggingPreview ? 'none' : 'transform 0.15s ease-out',
                                maxHeight: '85vh',
                                maxWidth: '90vw'
                            }}
                            className="object-contain pointer-events-none transition-transform select-none"
                        />
                    </div>
                </DialogContent>
            </Dialog>
            {/* Dialog: Daily Detail Breakdown */}
            <Dialog open={!!selectedDayDetail} onOpenChange={(open) => !open && setSelectedDayDetail(null)}>
                <DialogContent className="max-w-3xl w-full p-4 sm:p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
                    {selectedDayDetail && (
                        <div className="space-y-5">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Detalle Diario: {format(selectedDayDetail.dateObj, "EEEE, d 'de' MMMM yyyy", { locale: es })}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Desglose completo de cierres de caja (ingresos) y gastos (egresos) registrados este día.
                                </DialogDescription>
                            </DialogHeader>

                            {/* Day KPI Summary Banner */}
                            {(() => {
                                const realCash = selectedDayDetail.totalSalesCash || selectedDayDetail.totalGrossClosingIncome;
                                const netCash = realCash - selectedDayDetail.totalWithdrawals;

                                return (
                                    <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 border border-border/50 rounded-2xl text-center">
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Efectivo Real (Caja)</span>
                                            <span className="text-base sm:text-lg font-black text-emerald-500">${realCash.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Total Descontado</span>
                                            <span className="text-base sm:text-lg font-black text-amber-500">
                                                {selectedDayDetail.totalWithdrawals > 0 ? `-$${selectedDayDetail.totalWithdrawals.toLocaleString()}` : '$0.00'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Efectivo Neto Disponible</span>
                                            <span className="text-base sm:text-lg font-black text-primary">
                                                ${netCash.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Section 1: Cuadres de Caja */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Wallet className="h-4 w-4 text-emerald-500" />
                                        Cierres de Caja (Cuadres) del Día ({selectedDayDetail.closings.length})
                                    </h4>
                                    <Button
                                        size="sm"
                                        className="h-7 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1 shadow-sm"
                                        onClick={() => {
                                            handleDeductInvoiceFromCuadre(selectedDayDetail.dateObj, format(selectedDayDetail.dateObj, 'dd/MM/yyyy'));
                                        }}
                                    >
                                        <Receipt className="h-3 w-3" /> Descontar Factura a este Cuadre
                                    </Button>
                                </div>

                                {selectedDayDetail.closings.length === 0 ? (
                                    <div className="p-4 text-center bg-muted/10 rounded-xl text-xs text-muted-foreground italic">
                                        No se realizaron cierres de caja en este día.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedDayDetail.closings.map((c: any) => (
                                            <div key={c.id} className="p-3.5 bg-card border border-border/50 rounded-2xl space-y-2 text-xs shadow-sm">
                                                <div className="flex justify-between items-center font-bold">
                                                    <span className="text-foreground">
                                                        Cerrado por: {c.profile?.full_name || 'Cajero'}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                        <span className="text-muted-foreground text-[10px]">
                                                            {c.closing_time ? format(new Date(c.closing_time), 'hh:mm a') : ''}
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-[9px] font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 rounded-md gap-1"
                                                            onClick={() => {
                                                                const sessionTime = c.closing_time ? new Date(c.closing_time) : (c.created_at ? new Date(c.created_at) : selectedDayDetail.dateObj);
                                                                const label = `${c.profile?.full_name || 'Cajero'} (${c.closing_time ? format(new Date(c.closing_time), 'hh:mm a') : ''})`;
                                                                handleDeductInvoiceFromCuadre(sessionTime, label);
                                                            }}
                                                        >
                                                            <Receipt className="h-3 w-3" /> Descontar Factura
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-[9px] font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 rounded-md gap-1"
                                                            onClick={() => {
                                                                const sessionTimeStr = c.closing_time ? format(new Date(c.closing_time), "yyyy-MM-dd'T'HH:mm:ss") : selectedDayDetail.dateKey;
                                                                setDeductForm({
                                                                    amount: '',
                                                                    reason: `Retiro Cuadre (${c.profile?.full_name || 'Cajero'} - ${c.closing_time ? format(new Date(c.closing_time), 'hh:mm a') : ''})`,
                                                                    date: sessionTimeStr
                                                                });
                                                                setIsDeductOpen(true);
                                                            }}
                                                        >
                                                            <TrendingDown className="h-3 w-3" /> Descontar Dinero
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/30 text-[11px]">
                                                    <div>
                                                        <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Ventas Efectivo</span>
                                                        <span className="font-bold">${(c.total_sales_cash || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Depósitos (+)</span>
                                                        <span className="font-bold text-emerald-400">+${(c.total_cash_in || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Retiros Shift (-)</span>
                                                        <span className="font-bold text-amber-500">-${(c.total_cash_out || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                                                        <span className="text-[9px] text-emerald-400 font-bold uppercase block">Efectivo Real</span>
                                                        <span className="font-black text-emerald-400 text-xs">
                                                            ${(c.actual_cash || c.expected_cash || ((c.total_sales_cash || 0) + (c.total_cash_in || 0) - (c.total_cash_out || 0))).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                                                    <div>Tarjeta: <span className="font-bold text-foreground">${(c.total_sales_card || 0).toLocaleString()}</span></div>
                                                    <div>Transfer: <span className="font-bold text-foreground">${(c.total_sales_transfer || 0).toLocaleString()}</span></div>
                                                    <div>
                                                        Diferencia: <span className={`font-bold ${(c.difference || 0) === 0 ? 'text-emerald-500' : (c.difference || 0) > 0 ? 'text-emerald-400' : 'text-amber-500'}`}>
                                                            {(c.difference || 0) === 0 ? '$0.00' : (c.difference || 0) > 0 ? `+$${c.difference}` : `-$${Math.abs(c.difference || 0)}`}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Descuentos aplicados directamente a este cuadre */}
                                                {(() => {
                                                    const openTime = c.created_at ? new Date(c.created_at).getTime() : 0;
                                                    const closeTime = c.closing_time ? new Date(c.closing_time).getTime() : new Date().getTime();
                                                    
                                                    const allDayDeductions = [
                                                        ...selectedDayDetail.withdrawals.map((w: any) => ({
                                                            id: w.id,
                                                            reason: w.reason,
                                                            amount: w.amount,
                                                            profile: w.profile,
                                                            created_at: w.created_at,
                                                            isExpense: false
                                                        })),
                                                        ...selectedDayDetail.expenses.map((e: any) => ({
                                                            id: e.id,
                                                            reason: `${e.description}${e.supplier_name && e.supplier_name !== 'N/A' ? ` (${e.supplier_name})` : ''}`,
                                                            amount: e.amount,
                                                            profile: { full_name: 'Factura / Gasto' },
                                                            created_at: e.date ? e.date.toISOString() : e.created_at,
                                                            isExpense: true
                                                        }))
                                                    ];

                                                    const sessionWithdrawals = allDayDeductions.filter((w: any) => {
                                                        const wTime = new Date(w.created_at).getTime();
                                                        const inTimeWindow = (openTime > 0 && wTime >= (openTime - 15 * 60 * 1000) && wTime <= (closeTime + 15 * 60 * 1000));
                                                        const inReason = (w.reason || '').includes(c.profile?.full_name || '') || (w.reason || '').includes(c.id);
                                                        return inTimeWindow || inReason;
                                                    });

                                                    return sessionWithdrawals.length > 0 ? (
                                                        <div className="pt-2 border-t border-border/30 space-y-1.5">
                                                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">
                                                                Descuentos aplicados a este cuadre ({sessionWithdrawals.length})
                                                            </span>
                                                            <div className="space-y-1">
                                                                {sessionWithdrawals.map((w: any) => (
                                                                    <div key={w.id} className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-xs">
                                                                        <div>
                                                                            <span className="font-bold text-foreground block">{w.reason}</span>
                                                                            <span className="text-[9px] text-muted-foreground">
                                                                                Registrado por: {w.profile?.full_name || 'Usuario'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-amber-500">-${(w.amount || 0).toLocaleString()}</span>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-md"
                                                                                onClick={() => handleDeleteDeduction(w.id, w.isExpense)}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Descuentos y Retiros de Caja */}
                            {(() => {
                                const allDayDeductions = [
                                    ...selectedDayDetail.withdrawals.map((w: any) => ({
                                        id: w.id,
                                        reason: w.reason,
                                        amount: w.amount,
                                        profile: w.profile,
                                        isExpense: false
                                    })),
                                    ...selectedDayDetail.expenses.map((e: any) => ({
                                        id: e.id,
                                        reason: `${e.description}${e.supplier_name && e.supplier_name !== 'N/A' ? ` (${e.supplier_name})` : ''}`,
                                        amount: e.amount,
                                        profile: { full_name: 'Factura / Gasto' },
                                        isExpense: true
                                    }))
                                ];

                                return (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                                <TrendingDown className="h-4 w-4 text-amber-500" />
                                                Descuentos y Retiros de Caja ({allDayDeductions.length})
                                            </h4>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[10px] font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 rounded-lg gap-1"
                                                onClick={() => {
                                                    setDeductForm({ amount: '', reason: '', date: selectedDayDetail.dateKey });
                                                    setIsDeductOpen(true);
                                                }}
                                            >
                                                <Plus className="h-3 w-3" /> Descontar Dinero
                                            </Button>
                                        </div>

                                        {allDayDeductions.length === 0 ? (
                                            <div className="p-4 text-center bg-muted/10 rounded-xl text-xs text-muted-foreground italic">
                                                No hay descuentos ni retiros aplicados a este cuadre.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {allDayDeductions.map((w: any) => (
                                                    <div key={w.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
                                                        <div className="space-y-0.5">
                                                            <p className="font-bold text-foreground">{w.reason}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Registrado por: {w.profile?.full_name || 'Usuario'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-sm text-amber-500">-${(w.amount || 0).toLocaleString()}</span>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                                                                onClick={() => handleDeleteDeduction(w.id, w.isExpense)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Section 3: Egresos del Día */}
                            <div className="space-y-3 pt-2">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <TrendingDown className="h-4 w-4 text-red-500" />
                                    Egresos y Gastos Registrados ({selectedDayDetail.expenses.length})
                                </h4>

                                {selectedDayDetail.expenses.length === 0 ? (
                                    <div className="p-4 text-center bg-muted/10 rounded-xl text-xs text-muted-foreground italic">
                                        No hay egresos ni gastos registrados en este día.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedDayDetail.expenses.map((e: any) => (
                                            <div key={e.id} className="p-3 bg-card border border-border/50 rounded-xl flex items-center justify-between text-xs">
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-foreground">{e.description}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {e.supplier_name || 'Sin Proveedor'} • <span className="uppercase text-primary/80 font-bold">{e.category}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-sm text-red-500">-${(e.amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="pt-4 border-t">
                                <Button variant="outline" className="w-full rounded-xl" onClick={() => setSelectedDayDetail(null)}>
                                    Cerrar Detalle
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog: Descontar Dinero del Cuadre */}
            <Dialog open={isDeductOpen} onOpenChange={setIsDeductOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-left flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-amber-500" />
                            Descontar Dinero del Cuadre
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Registra un retiro o ajuste para restar dinero al cuadre de caja de esa fecha.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-3">
                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="deduct-date" className="text-xs font-bold text-muted-foreground uppercase">Fecha del Cuadre</Label>
                            <Input
                                id="deduct-date"
                                type="date"
                                className="h-10 rounded-xl"
                                value={deductForm.date}
                                onChange={(e) => setDeductForm({ ...deductForm, date: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="deduct-amount" className="text-xs font-bold text-muted-foreground uppercase">Monto a Descontar ($)</Label>
                            <Input
                                id="deduct-amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="h-10 rounded-xl font-bold text-lg text-amber-500"
                                value={deductForm.amount}
                                onChange={(e) => setDeductForm({ ...deductForm, amount: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2 text-left">
                            <Label htmlFor="deduct-reason" className="text-xs font-bold text-muted-foreground uppercase">Motivo / Razón del Descuento</Label>
                            <Input
                                id="deduct-reason"
                                placeholder="Ej. Depósito bancario, Retiro de caja, Ajuste"
                                className="h-10 rounded-xl"
                                value={deductForm.reason}
                                onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="rounded-xl h-10 text-xs font-bold" onClick={() => setIsDeductOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleRegisterDeduction}
                            disabled={isCreatingMovement}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-6 rounded-xl gap-2"
                        >
                            {isCreatingMovement ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingDown className="h-4 w-4" />}
                            Aplicar Descuento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

export default function Accounting() {
    return (
        <WithPlanAccess
            feature="canAccessAccounting"
            requiredPlan="pro"
            featureName="Contabilidad"
        >
            <AccountingContent />
        </WithPlanAccess>
    );
}
