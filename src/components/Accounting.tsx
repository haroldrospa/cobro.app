import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, TrendingDown, TrendingUp, Building2, Calendar, FileText, Search, Filter, Trash2, Camera, Loader2, Check, CheckCheck, ChevronsUpDown, ChevronLeft, ChevronRight, AlertCircle, ShoppingCart, Receipt, Sparkles, PenTool, Eye, EyeOff, Settings2, Upload, X, Download, ZoomIn, ZoomOut, RotateCw, RefreshCw } from 'lucide-react';
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
import { useExpenses } from '@/hooks/useExpenses';
import { useFixedExpenses, FixedExpense } from '@/hooks/useFixedExpenses';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useSupplierDebts, SupplierDebt } from '@/hooks/useSupplierDebts';
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { lookupRnc } from '@/lib/rncLookup';


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
    const { expenses, createExpense, deleteExpense, isLoading: loadingExpenses, isCreating } = useExpenses();
    const { suppliers, createSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
    const { settings: storeSettings, updateSettings } = useStoreSettings();

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

    console.log("=== VERSION DE DEPURACION DE IA DE LA CONTABILIDAD CARGADA ===");

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

    const cleanKey = (key: string | null | undefined) => {
        if (!key) return null;
        const trimmed = key.trim();
        if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') return null;
        return trimmed;
    };

    const systemKey = cleanKey(import.meta.env.VITE_GROQ_API_KEY);
    const userKey = cleanKey(storeSettings?.ai_api_key);
    const isKeyConfigured = !!(systemKey || userKey);

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

    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({});
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



    // Load queue item data into form
    useEffect(() => {
        if (scanQueue.length > 0 && scanQueue[reviewIndex]) {
            const item = scanQueue[reviewIndex];
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
                    image_url: data.image_url || null
                }));
            } else if (item.status === 'error') {
                toast({ title: "Error", description: item.error || "No se pudo leer esta factura. Ingrésala manual.", variant: "destructive" });
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

            await createExpense({
                date: newExpense.date || new Date(),
                description: newExpense.description,
                amount: Number(newExpense.amount),
                category: newExpense.category || 'Otros',
                supplier_id: finalSupplierId,
                invoice_number: newExpense.invoice_number,
                image_url: newExpense.image_url
            });

            console.log("Expense created successfully via mutation");

            toast({ title: "Guardado", description: "Gasto registrado exitosamente." });

            if (scanQueue.length > 0) {
                // Mark current item as saved in scanQueue
                const currentItem = scanQueue[reviewIndex];
                if (currentItem) {
                    setScanQueue(prev => prev.map(i => i.id === currentItem.id ? { ...i, status: 'saved' } : i));
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

    const handleAddSupplier = async () => {
        if (!newSupplier.name) return;

        try {
            await createSupplier({
                name: newSupplier.name,
                rnc: newSupplier.rnc || null,
                contact: newSupplier.contact || null
            });
            setIsAddSupplierOpen(false);
            setNewSupplier({});
        } catch (error) {
            console.error(error);
        }
    };

    const preprocessImage = async (file: File): Promise<string> => {
        let processableFile = file;

        // Convert HEIC/HEIF to JPEG first
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            console.log("Converting HEIC to JPEG...");
            try {
                const heic2anyModule = await import('heic2any');
                const heic2anyFn = heic2anyModule.default || heic2anyModule;
                const convertedBlob = await heic2anyFn({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.6
                });
                
                const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                processableFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), {
                    type: "image/jpeg"
                });
            } catch (err) {
                console.error("Error converting HEIC:", err);
                throw new Error("Error convirtiendo formato iPhone (HEIC). Prueba tomando la foto de nuevo.");
            }
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(processableFile);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Reducir resolución para no saturar memoria de móviles y ahorrar tokens/latencia
                const MAX_WIDTH = 1200; 
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                if (!ctx) {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(processableFile);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                if (dataUrl === 'data:,' || dataUrl.length < 100) {
                    // Fallback si el canvas falló silenciosamente (común en algunos móviles)
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(processableFile);
                } else {
                    resolve(dataUrl);
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
                reader.readAsDataURL(processableFile);
            };
            
             const scanInvoice = async (file: File, apiKey: string, onStatusUpdate?: (msg: string) => void): Promise<any> => {
        const base64DataUrl = await preprocessImage(file);
        const base64Data = base64DataUrl.split(',')[1];
        const mimeType = base64DataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

        const prompt = `Analiza esta factura y extrae los siguientes datos en formato JSON strictly:
- date (formato YYYY-MM-DD)
- description (resumen breve del gasto)
- amount (número, sin símbolos)
- supplier_name (nombre comercial del proveedor)
- invoice_number (NCF o número de referencia)
- category (Una de: Inventario, Servicios Públicos, Alquiler, Nómina, Mantenimiento, Marketing, Impuestos, Otros)

Si algún dato no es visible, usa null. El JSON debe ser plano. Ejemplo: {"date": "2023-01-01", "description": "Compra de agua", "amount": 100, "supplier_name": "Agua Pura", "invoice_number": "B0100000001", "category": "Otros"}`;

        const maxRetries = 4;
        let attempt = 0;

        while (attempt <= maxRetries) {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "qwen/qwen3.6-27b",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (response.ok) {
                const data = await response.json();
                let content = data.choices?.[0]?.message?.content;
                if (!content) throw new Error("No content received from Groq");
                
                content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                
                // Extraer primer JSON equilibrado
                const extractJSON = (str: string): string => {
                    const firstBrace = str.indexOf('{');
                    if (firstBrace === -1) return str;
                    let braceCount = 0;
                    let inString = false;
                    let escaped = false;
                    for (let i = firstBrace; i < str.length; i++) {
                        const char = str[i];
                        if (escaped) {
                            escaped = false;
                            continue;
                        }
                        if (char === '\\') {
                            escaped = true;
                            continue;
                        }
                        if (char === '"') {
                            inString = !inString;
                            continue;
                        }
                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    return str.slice(firstBrace, i + 1);
                                }
                            }
                        }
                    }
                    const match = str.match(/\{[\s\S]*\}/);
                    return match ? match[0] : str;
                };

                let clean = extractJSON(content);
                // Sanitizar comas sobrantes antes de cierres (trailing commas)
                clean = clean.replace(/,\s*([\]}])/g, '$1');
                return JSON.parse(clean);
            }

            const errorData = await response.json().catch(() => ({}));
            const errorMsg = JSON.stringify(errorData);

            if (response.status === 429 && attempt < maxRetries) {
                attempt++;
                let waitMs = Math.pow(2, attempt) * 5000;
                const matchSeconds = errorMsg.match(/try again in ([\d\.]+)s/i);
                if (matchSeconds && matchSeconds[1]) {
                    const parsedSec = parseFloat(matchSeconds[1]);
                    if (!isNaN(parsedSec) && parsedSec > 0) {
                        waitMs = Math.ceil((parsedSec + 2) * 1000);
                    }
                }

                const waitSec = Math.ceil(waitMs / 1000);
                onStatusUpdate?.(`Límite IA alcanzado (429). Esperando ${waitSec}s... (${attempt}/${maxRetries})`);

                await new Promise(resolve => setTimeout(resolve, waitMs));
                continue;
            }

            throw new Error(`Groq API Error: ${response.status} ${errorMsg}`);
        }
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
        const userKey = cleanKey(storeSettings?.ai_api_key);
        const systemKey = cleanKey(import.meta.env.VITE_GROQ_API_KEY);
        const apiKey = userKey || systemKey;

        if (!apiKey) {
            toast({ title: "Requerido", description: "Primero guarda tu API Key de Groq en la configuración de la ventana.", variant: "destructive" });
            return;
        }

        setIsScanning(true);

        try {
            for (let i = 0; i < itemsToProcess.length; i++) {
                const item = itemsToProcess[i];
                // Marcar como escaneando
                setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'scanning', statusMessage: undefined } : q));

                try {
                    console.log(`Scanning item ${item.file.name}...`);
                    const data = await scanInvoice(item.file, apiKey, (statusMsg) => {
                        setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, statusMessage: statusMsg } : q));
                    });

                    console.log(`Uploading receipt image to storage...`);
                    const imageUrl = await uploadReceiptImage(item.file);
                    const dataWithImage = { ...data, image_url: imageUrl };

                    setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', extractedData: dataWithImage, statusMessage: undefined } : q));
                    console.log(`✅ Factura procesada exitosamente.`);

                    // Pausa de 2.5s entre solicitudes para evitar sobrepasar límites de tokens por minuto (TPM)
                    if (i < itemsToProcess.length - 1) {
                        await new Promise(res => setTimeout(res, 2500));
                    }
                } catch (err: any) {
                    console.error(`❌ Error procesando factura (${item.file.name}):`, err);
                    const errorMsg = err.message || "Error desconocido";
                    setScanQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: errorMsg, statusMessage: undefined } : q));

                    if (itemsToProcess.length === 1) {
                        toast({
                            title: "Error de Escaneo",
                            description: errorMsg.includes("429") ? "Límite de solicitudes por minuto alcanzado. Haz clic en Reintentar." :
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

        const newItems: QueueItem[] = Array.from(files).map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            file: f,
            status: 'pending'
        }));

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
                <div className="flex justify-center w-full">
                    <TabsList className="bg-muted/20 p-1 rounded-2xl border border-border/50 h-auto self-center">
                        <TabsTrigger value="expenses" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Gastos</TabsTrigger>
                        <TabsTrigger value="fixed-expenses" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Gastos Fijos</TabsTrigger>
                        <TabsTrigger value="suppliers" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Proveedores</TabsTrigger>
                        <TabsTrigger value="reports" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg">Reportes</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="expenses" className="space-y-6">
                    <div className="max-w-2xl mx-auto w-full flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                            <Input placeholder="Buscar por descripción o proveedor..." className="pl-11 h-12 bg-muted/20 border-border/50 rounded-2xl focus:ring-primary/20" />
                        </div>
                        <Button variant="outline" className="h-12 w-12 rounded-2xl bg-muted/20 border-border/50">
                            <Filter className="h-5 w-5 text-muted-foreground" />
                        </Button>
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
                                    ) : filteredExpenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-bold italic">No hay registros este mes</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredExpenses.map((expense) => (
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
                            ) : filteredExpenses.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground font-black uppercase tracking-widest text-xs border-2 border-dashed rounded-3xl">Sin registros este mes</div>
                            ) : (
                                filteredExpenses.map((expense) => (
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
                            onClick={() => setIsAddSupplierOpen(true)}
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
                                placeholder="Buscar proveedor por nombre, RNC o contacto..."
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
                                    (s.contact || '').toLowerCase().includes(term);
                                const debt = getSupplierOutstandingDebt(s.id);
                                const matchFilter =
                                    supplierDebtFilter === 'all' ||
                                    (supplierDebtFilter === 'with_debt' && debt > 0) ||
                                    (supplierDebtFilter === 'no_debt' && debt === 0);
                                return matchSearch && matchFilter;
                            })
                            .sort((a, b) => {
                                // Sort by debt amount descending (debtors first)
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
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3">Contacto</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3 text-right">Deuda Pendiente</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 py-3 text-center pr-5">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((supplier) => {
                                            const outstanding = getSupplierOutstandingDebt(supplier.id);
                                            const hasDebt = outstanding > 0;
                                            return (
                                                <TableRow key={supplier.id} className="hover:bg-muted/20 transition-colors border-b border-border/20 group">
                                                    <TableCell className="py-4 pl-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                                                                hasDebt ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                                                            }`}>
                                                                {supplier.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="font-semibold text-sm">{supplier.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm text-muted-foreground font-mono">
                                                        {supplier.rnc || <span className="text-border">—</span>}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm text-muted-foreground">
                                                        {supplier.contact || <span className="text-border">—</span>}
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
                                                    <TableCell className="py-4 pr-5">
                                                        <div className="flex items-center justify-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 text-primary hover:bg-primary/10"
                                                                onClick={() => {
                                                                    setSelectedSupplierForDebt(supplier);
                                                                    setDebtForm({ amount: '', description: '', category: 'Inventario', due_date: '' });
                                                                    setIsAddDebtOpen(true);
                                                                }}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" /> Deuda
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                onClick={() => {
                                                                    setSelectedSupplierForView(supplier);
                                                                    setIsViewDebtsOpen(true);
                                                                }}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" /> Ver
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
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
                                ) : fixedExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm font-medium">
                                            No tienes gastos fijos mensuales registrados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    fixedExpenses.map((fixed) => {
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
                if (!open) {
                    setIsScanning(false);
                    setScanQueue([]);
                }
            }}>
                <DialogContent centerOnMobile className={cn("p-4 sm:p-6 max-h-[85dvh] gap-3 sm:gap-4 overflow-y-auto transition-all duration-300", scanQueue.length > 0 ? "sm:max-w-4xl" : "sm:max-w-[560px]")}>
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
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input 
                                        type={showApiKey ? "text" : "password"} 
                                        placeholder="Pegar código de Groq..." 
                                        value={apiKeyInput}
                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
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

                    {isKeyConfigured && !isEditingKey && (
                        <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 mb-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Sparkles className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">IA Configurada</p>
                                    <p className="text-xs font-bold text-muted-foreground">La clave de Groq está lista para usar</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    setApiKeyInput(storeSettings?.ai_api_key || '');
                                    setIsEditingKey(true);
                                }}
                                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-background border hover:bg-muted"
                            >
                                <Settings2 className="h-3 w-3 mr-1" /> Configurar
                            </Button>
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
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[450px]">
                            {/* Left Column: Queue Manager */}
                            <div className="md:col-span-5 flex flex-col gap-4 border-r border-border/20 pr-4">
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
                                    <Button 
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs h-9 rounded-xl font-semibold"
                                        onClick={() => {
                                            setIsAddExpenseOpen(false);
                                            setScanQueue([]);
                                        }}
                                    >
                                        Cerrar Ventana
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Right Column: Review Details Form */}
                            <div className="md:col-span-7 flex flex-col justify-center">
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
                                ) : scanQueue[reviewIndex]?.status === 'error' ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center p-6 bg-red-500/5 rounded-2xl border border-red-500/20">
                                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                            <AlertCircle className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-foreground">No se pudo procesar esta factura</p>
                                            <p className="text-xs text-muted-foreground max-w-sm line-clamp-3">
                                                {scanQueue[reviewIndex]?.error || "Ocurrió un error al comunicarse con la IA de Groq."}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 rounded-xl"
                                            onClick={() => handleRetrySingleItem(scanQueue[reviewIndex].id)}
                                            disabled={isScanning}
                                        >
                                            <RefreshCw className="h-4 w-4" /> Reintentar escaneo de esta factura
                                        </Button>
                                    </div>
                                ) : (
                                    /* Form for success/error/saved */
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between pb-1 border-b border-border/30">
                                            <h4 className="font-black text-xs uppercase tracking-wider text-muted-foreground">Datos del Gasto Seleccionado</h4>
                                            <span className="text-[10px] font-bold text-muted-foreground max-w-[200px] truncate">
                                                {scanQueue[reviewIndex]?.file.name}
                                            </span>
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
                                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 text-xs font-bold text-emerald-500 flex items-center gap-1.5 shadow-sm">
                                                    <Check className="h-4 w-4" /> Registrado
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

            {/* Dialog: Add Supplier */}
            <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
                        <DialogDescription>
                            Agrega un nuevo proveedor a tu directorio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-rnc" className="text-right">RNC</Label>
                            <div className="col-span-3 relative flex items-center">
                                <Input
                                    id="sup-rnc"
                                    placeholder="000-00000-0"
                                    className="pr-12 w-full"
                                    value={newSupplier.rnc || ''}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, rnc: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 w-8 h-8 text-zinc-400 hover:text-white"
                                    onClick={handleLookupSupplierRnc}
                                    disabled={isLookingUpSupplierRnc || !newSupplier.rnc}
                                    title="Buscar en DGII"
                                >
                                    {isLookingUpSupplierRnc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-name" className="text-right">Nombre</Label>
                            <Input
                                id="sup-name"
                                placeholder="Ej. Distribuidora ABC"
                                className="col-span-3"
                                value={newSupplier.name || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-contact" className="text-right">Contacto</Label>
                            <Input
                                id="sup-contact"
                                placeholder="Teléfono o Email"
                                className="col-span-3"
                                value={newSupplier.contact || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddSupplier} type="submit">Guardar Proveedor</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Expense Details */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card border border-border/60 rounded-3xl">
                    <DialogHeader className="p-6 pb-4 border-b border-border/30 bg-muted/20">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                    <span>📄 Detalle del Gasto</span>
                                </DialogTitle>
                                <DialogDescription className="text-xs font-semibold text-muted-foreground mt-1">
                                    Información del comprobante de compra
                                </DialogDescription>
                            </div>
                            {selectedExpenseForDetails?.category && (
                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                                    isReinvestment(selectedExpenseForDetails.category)
                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                }`}>
                                    {selectedExpenseForDetails.category}
                                </span>
                            )}
                        </div>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-5">
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
                    
                    <DialogFooter className="p-4 border-t border-border/30 bg-muted/10 sm:justify-end">
                        <Button
                            onClick={() => setIsDetailsOpen(false)}
                            className="w-full sm:w-auto font-bold rounded-xl px-5"
                        >
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Add/Edit Fixed Expense */}
            <Dialog open={isAddFixedOpen} onOpenChange={setIsAddFixedOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/50">
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
                <DialogContent className="sm:max-w-[425px] rounded-2xl border border-border/50">
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

            {/* Dialog: Ver Deudas de Proveedor */}
            <Dialog open={isViewDebtsOpen} onOpenChange={setIsViewDebtsOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl border border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-left flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Historial de Deudas: {selectedSupplierForView?.name}
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Consulta el estado de las cuentas por pagar y registra abonos o liquidaciones.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {(() => {
                            const list = supplierDebts.filter(d => d.supplier_id === selectedSupplierForView?.id);
                            if (list.length === 0) {
                                return (
                                    <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                                        <Check className="h-10 w-10 text-emerald-500 bg-emerald-500/10 p-2 rounded-full" />
                                        <span>No tienes ninguna deuda registrada con este proveedor.</span>
                                    </div>
                                );
                            }
                            return (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Concepto</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Pagado</TableHead>
                                            <TableHead className="text-right">Pendiente</TableHead>
                                            <TableHead>Vencimiento</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {list.map((debt) => {
                                            const remaining = Number(debt.amount) - Number(debt.amount_paid);
                                            return (
                                                <TableRow key={debt.id}>
                                                    <TableCell className="font-medium">
                                                        <div>{debt.description}</div>
                                                        <div className="text-xs text-muted-foreground">{debt.category}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">${Number(debt.amount).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-emerald-500">${Number(debt.amount_paid).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-red-500 font-bold">${remaining.toLocaleString()}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {debt.due_date ? format(new Date(debt.due_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es }) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs">
                                                        {debt.status === 'paid' && (
                                                            <span className="px-2 py-0.5 rounded-full font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Pagado</span>
                                                        )}
                                                        {debt.status === 'partial' && (
                                                            <span className="px-2 py-0.5 rounded-full font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">Parcial</span>
                                                        )}
                                                        {debt.status === 'pending' && (
                                                            <span className="px-2 py-0.5 rounded-full font-black bg-red-500/10 text-red-500 border border-red-500/20">Pendiente</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end items-center gap-1">
                                                            {debt.status !== 'paid' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 rounded-lg text-xs"
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
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleDeleteDebt(debt.id, debt.description)}
                                                                disabled={isDeletingSupplierDebt}
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
                            );
                        })()}
                    </div>
                    <DialogFooter>
                        <Button className="rounded-xl px-5" onClick={() => setIsViewDebtsOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Registrar Pago / Abono a Deuda */}
            <Dialog open={isPayDebtOpen} onOpenChange={setIsPayDebtOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-2xl border border-border/50">
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
