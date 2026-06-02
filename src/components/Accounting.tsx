import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, DollarSign, TrendingDown, TrendingUp, Building2, Calendar, FileText, Search, Filter, Trash2, Camera, Loader2, Check, ChevronsUpDown, ChevronLeft, ChevronRight, AlertCircle, ShoppingCart, Receipt, Sparkles, PenTool, Eye, EyeOff, Settings2 } from 'lucide-react';
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
import { useSuppliers } from '@/hooks/useSuppliers';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { WithPlanAccess } from '@/components/subscription/WithPlanAccess';
import { Skeleton } from '@/components/ui/skeleton';


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
    };

    const [scanQueue, setScanQueue] = useState<QueueItem[]>([]);
    const [reviewIndex, setReviewIndex] = useState(0);
    const { toast } = useToast();
    const { data: sales = [], isLoading: loadingSales } = useSales();
    const { expenses, createExpense, deleteExpense, isLoading: loadingExpenses, isCreating } = useExpenses();
    const { suppliers, createSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
    const { settings: storeSettings, updateSettings } = useStoreSettings();

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
    }>({
        date: new Date(),
        description: '',
        amount: '',
        category: 'Inventario',
        supplier_name: '',
        invoice_number: ''
    });

    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({});
    // Expense type: 'reinversion' = Inventario, 'operativo' = all others
    const [expenseType, setExpenseType] = useState<'reinversion' | 'operativo'>('reinversion');

    const operativeCategories = CATEGORIES.filter(c => !REINVESTMENT_CATEGORIES.includes(c));
    const availableCategories = expenseType === 'reinversion' ? REINVESTMENT_CATEGORIES : operativeCategories;

    const handleExpenseTypeChange = (type: 'reinversion' | 'operativo') => {
        setExpenseType(type);
        const defaultCat = type === 'reinversion' ? 'Inventario' : 'Servicios Públicos';
        setNewExpense(prev => ({ ...prev, category: defaultCat }));
    };

    const [currentDate, setCurrentDate] = useState(() => {
        const savedDate = sessionStorage.getItem('accounting_view_date');
        return savedDate ? new Date(savedDate) : new Date();
    });

    useEffect(() => {
        if (currentDate) {
            sessionStorage.setItem('accounting_view_date', currentDate.toISOString());
        }
    }, [currentDate]);

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
            if (item.status === 'success' && item.extractedData) {
                const data = item.extractedData;
                setNewExpense(prev => ({
                    ...prev,
                    date: data.date ? new Date(data.date) : new Date(),
                    description: data.description || `Gasto en ${data.supplier_name || 'Desconocido'}`,
                    amount: typeof data.amount === 'number' ? data.amount : (parseFloat(data.amount) || 0),
                    supplier_name: data.supplier_name || '',
                    invoice_number: data.invoice_number || '',
                    category: data.category || 'Otros'
                }));
            } else if (item.status === 'error') {
                toast({ title: "Error", description: item.error || "No se pudo leer esta factura. Ingrésala manual.", variant: "destructive" });
                // Reset form to clean state for manual entry but keep context if needed?
                // Actually better to clear it to avoid confusion
                setNewExpense({
                    date: new Date(),
                    description: '',
                    amount: '',
                    category: 'Inventario',
                    supplier_name: '',
                    invoice_number: ''
                });
            }
        }
    }, [reviewIndex, scanQueue]);

    const handleSkipItem = () => {
        if (reviewIndex < scanQueue.length - 1) {
            setReviewIndex(prev => prev + 1);
        } else {
            setIsAddExpenseOpen(false);
            setScanQueue([]);
            setReviewIndex(0);
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
                image_url: null
            });

            console.log("Expense created successfully via mutation");

            toast({ title: "Guardado", description: "Gasto registrado exitosamente." });

            if (scanQueue.length > 0) {
                // Batch Mode: Move to next
                if (reviewIndex < scanQueue.length - 1) {
                    setReviewIndex(prev => prev + 1);
                } else {
                    // Finished batch
                    setIsAddExpenseOpen(false);
                    setScanQueue([]);
                    setReviewIndex(0);
                    toast({ title: "Proceso Completo", description: "Todas las facturas han sido procesadas." });
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
                    invoice_number: ''
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
            
            img.src = url;
        });
    };

    const scanInvoice = async (file: File, apiKey: string): Promise<any> => {
        const base64DataUrl = await preprocessImage(file);
        const base64Data = base64DataUrl.split(',')[1];
        const mimeType = base64DataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

        const prompt = `Analiza esta factura y extrae los siguientes datos en formato JSON estrictamente:
- date (formato YYYY-MM-DD)
- description (resumen breve del gasto)
- amount (número, sin símbolos)
- supplier_name (nombre comercial del proveedor)
- invoice_number (NCF o número de referencia)
- category (Una de: Inventario, Servicios Públicos, Alquiler, Nómina, Mantenimiento, Marketing, Impuestos, Otros)

Si algún dato no es visible, usa null. El JSON debe ser plano. Ejemplo: {"date": "2023-01-01", "description": "Compra de agua", "amount": 100, "supplier_name": "Agua Pura", "invoice_number": "B0100000001", "category": "Otros"}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Groq API Error: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("No content received from Groq");
        
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            content = jsonMatch[0];
        }
        return JSON.parse(content);
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
            image_url: null
        });

        // Notify if supplier is new, just as a warning/info
        if (data.supplier_name && !foundSupplier) {
            console.log(`Proveedor nuevo detectado: ${data.supplier_name}`);
        }
    };


    const processReceiptImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const userKey = cleanKey(storeSettings?.ai_api_key);
        const systemKey = cleanKey(import.meta.env.VITE_GROQ_API_KEY);
        const apiKey = userKey || systemKey;

        console.log("Resolved API Key source:", userKey ? "User custom key (from DB)" : systemKey ? "System fallback key (from env)" : "No key found");
        console.log("Using API Key (first 10 chars):", apiKey ? apiKey.slice(0, 10) + "..." : "none");

        if (!apiKey) {
            toast({ title: "Requerido", description: "Primero guarda tu API Key de Groq en la configuración de la ventana.", variant: "destructive" });
            return;
        }

        const isMassive = files.length > 1;

        // Create new queue items
        const newItems: QueueItem[] = Array.from(files).map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            file: f,
            status: 'pending'
        }));

        // Append to existing queue
        setScanQueue(prev => [...prev, ...newItems]);
        setIsScanning(true);
        console.log(`🚀 Iniciando escaneo de ${newItems.length} nuevos archivos...`);

        try {
            // Procesamiento SECUENCIAL para evitar saturar la memoria y red en móviles
            for (const item of newItems) {
                // Marcar como escaneando
                setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'scanning' } : i));

                try {
                    console.log(`Scanning item ${item.file.name}...`);
                    const data = await scanInvoice(item.file, apiKey);

                    if (isMassive) {
                        await saveExpenseToDb(data);
                        setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved', extractedData: data } : i));
                        toast({ title: "Guardado Automático", description: `Factura ${data.invoice_number || ''} guardada.` });
                    } else {
                        setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', extractedData: data } : i));
                    }
                    console.log(`✅ Factura procesada exitosamente.`);
                } catch (err: any) {
                    console.error(`❌ Error procesando factura (${item.file.name}):`, err);
                    
                    const errorMsg = err.message || "Error desconocido";
                    setScanQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
                    
                    // Si no es masivo, mostrar toast inmediato del error específico
                    if (!isMassive) {
                        toast({ 
                            title: "Error de Escaneo", 
                            description: errorMsg.includes("401") ? "API Key inválida o vencida." : 
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
                                            <TableRow key={expense.id} className="hover:bg-muted/20 transition-colors border-b border-border/30">
                                                <TableCell className="text-[11px] font-bold text-muted-foreground">
                                                    {expense.date && isValid(expense.date) ? format(expense.date, 'dd/MM/yyyy') : '-'}
                                                </TableCell>
                                                <TableCell className="font-bold text-sm tracking-tight">{expense.description}</TableCell>
                                                <TableCell className="text-[11px] font-black uppercase text-primary/70">{expense.supplier_name || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${isReinvestment(expense.category) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                                        {expense.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-base pr-8">
                                                    ${(expense.amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
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
                                    <div key={expense.id} className="bg-muted/10 border border-border/50 rounded-3xl p-5 space-y-4 shadow-sm relative overflow-hidden group active:bg-muted/20 transition-all">
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
                                        
                                        <div className="flex justify-between items-center pt-3 border-t border-border/30">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">ID: #{expense.id.slice(0,6)}</span>
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

                <TabsContent value="suppliers" className="space-y-4">
                    <div className="flex justify-between">
                        <h3 className="text-lg font-medium">Directorio de Proveedores</h3>
                        <Button variant="outline" size="sm" onClick={() => setIsAddSupplierOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Proveedor
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {suppliers.map((supplier) => (
                            <Card key={supplier.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <CardTitle className="text-base font-medium truncate max-w-[150px]">{supplier.name}</CardTitle>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" 
                                        onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="mt-2 text-sm">
                                    <div className="grid gap-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">RNC:</span>
                                            <span>{supplier.rnc || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Contacto:</span>
                                            <span>{supplier.contact || 'N/A'}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
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
            </Tabs>

            {/* Dialog: Add Expense */}
            <Dialog open={isAddExpenseOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsScanning(false);
                    setScanQueue([]);
                }
                setIsAddExpenseOpen(open);
            }}>
                <DialogContent className="sm:max-w-[560px] p-4 sm:p-6 max-h-[92vh] sm:max-h-[85vh] gap-3 sm:gap-4 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {scanQueue.length > 0 ? "Gestión de Facturas" : "Registrar Nuevo Gasto"}
                        </DialogTitle>
                        <DialogDescription>
                            {scanQueue.length > 1
                                ? "Procesando múltiples facturas automáticamente."
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
                                Introduce tu API key de Groq para usar el modelo Llama 4 Scout y escanear tus facturas.
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

                    {/* Mode Selection Toggle */}
                    {scanQueue.length === 0 && (
                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/40 rounded-2xl mb-4 border border-border/50">
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
                    )}

                    {/* AI Mode Upload Box */}
                    {expenseEntryMode === 'ia' && scanQueue.length === 0 && (
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

                    <AnimatePresence mode='wait'>
                        {scanQueue.length > 1 ? (
                            <motion.div
                                key="massive-list"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="bg-muted/30 rounded-lg p-4 border space-y-3 max-h-[400px] overflow-y-auto">
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <h3 className="font-semibold text-sm">Cola de Procesamiento</h3>
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                            {scanQueue.filter(i => i.status === 'saved').length}/{scanQueue.length} Guardadas
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {scanQueue.map((item, idx) => (
                                            <div key={item.id} className="flex items-center justify-between bg-card p-3 rounded-md border shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium truncate max-w-[200px]">
                                                            {item.file.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {item.status === 'pending' && "En cola..."}
                                                            {item.status === 'scanning' && "Analizando..."}
                                                            {item.status === 'saved' && "Guardado exitosamente"}
                                                            {item.status === 'error' && "Falló el análisis"}
                                                            {item.status === 'success' && "Listo para revisar"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    {item.status === 'scanning' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                                    {item.status === 'saved' && <Check className="h-5 w-5 text-green-500" />}
                                                    {item.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                                                    {item.status === 'success' && (
                                                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                                                            setScanQueue([item]); // Switch to single mode to review this one
                                                            setReviewIndex(0);
                                                        }}>
                                                            Revisar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {scanQueue.every(i => i.status === 'saved') && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2"
                                    >
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                            <Check className="h-6 w-6 text-green-600" />
                                        </div>
                                        <h3 className="font-bold text-green-800">¡Todo listo!</h3>
                                        <p className="text-sm text-green-700">Todas las facturas han sido procesadas y guardadas correctamente.</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        ) : (expenseEntryMode === 'manual' || scanQueue.length === 1) ? (
                            <motion.div
                                key="single-form"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-3 pt-1"
                            >
                                {/* ── TYPE SELECTOR ── */}
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
                                {/* hint label */}
                                <p className="-mt-1 text-[11px] text-center font-medium tracking-wide text-green-400">
                                    {expenseType === 'reinversion'
                                        ? '📦 Compra de mercadería / inventario para vender'
                                        : '🏢 Alquiler, nómina, servicios, mantenimiento, etc.'}
                                </p>

                                {/* ── AMOUNT hero ── */}
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

                                {/* ── CONCEPT + DATE row ── */}
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

                                {/* ── CATEGORY pills ── */}
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

                                {/* ── SUPPLIER + INVOICE row ── */}
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
                            </motion.div>

                        ) : null}
                    </AnimatePresence>

                    <DialogFooter className="sm:justify-between">
                        {scanQueue.length > 1 ? (
                            <div className="flex w-full justify-between items-center">
                                <span className="text-xs text-muted-foreground flex items-center">
                                    {isScanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    {isScanning ? "Procesando más facturas..." : "Proceso completado"}
                                </span>
                                <Button variant="outline" onClick={() => {
                                    setIsAddExpenseOpen(false);
                                    setScanQueue([]);
                                }}>
                                    Cerrar Ventana
                                </Button>
                            </div>
                        ) : (
                            <>
                                {scanQueue.length > 0 && scanQueue[0].status === 'success' && (
                                    <Button variant="ghost" onClick={() => {
                                        setIsAddExpenseOpen(false);
                                        setScanQueue([]);
                                        setNewExpense({
                                            date: new Date(),
                                            description: '',
                                            amount: '',
                                            category: 'Inventario',
                                            supplier_name: '',
                                            invoice_number: ''
                                        });
                                    }}>
                                        Cancelar
                                    </Button>
                                )}
                                {(expenseEntryMode === 'manual' || scanQueue.length === 1) && (
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <Button
                                            onClick={handleAddExpense}
                                            disabled={isCreating}
                                            className="font-bold px-6 shadow-lg transition-all duration-200 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-green-500/30"
                                        >
                                            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                                            {isCreating ? "Guardando..." : expenseType === 'reinversion' ? '💾 Guardar Reinversión' : '💾 Guardar Gasto'}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </DialogFooter>
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
                            <Label htmlFor="sup-rnc" className="text-right">RNC</Label>
                            <Input
                                id="sup-rnc"
                                placeholder="000-00000-0"
                                className="col-span-3"
                                value={newSupplier.rnc || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, rnc: e.target.value })}
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
