import { useState, useRef, FC, ChangeEvent, useEffect, useMemo, useCallback, memo } from 'react';
import { Package, Plus, Search, Edit, Trash2, Upload, Download, Hash, Barcode, Tag, DollarSign, AlertTriangle, Printer, Loader2, ImageIcon, Pencil, ChefHat, FlaskConical, RefreshCw, Asterisk, Sparkles, Check, PlusCircle, ChevronDown, ChevronUp, Save, History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDeleteAllProducts, Product } from '@/hooks/useProducts';
import { cn } from "@/lib/utils";
import { useProductsOffline, useDeleteProductOffline, useUpdateProductOffline, useCreateProductOffline } from '@/hooks/useProductsOffline';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useDebounce } from '@/hooks/useDebounce';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useBusinessType } from '@/hooks/useBusinessType';
import { ActiveOffersSheet } from '@/components/products/ActiveOffersSheet';
import { PrintLabelsDialog } from '@/components/products/PrintLabelsDialog';
import { ImportProductsDialog } from '@/components/products/ImportProductsDialog';
import { RestaurantInventoryControl } from '@/components/products/RestaurantInventoryControl';
import ProductForm from './ProductForm';
import { LimitReachedDialog } from './subscription/PlanRestrictions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipeAvailability } from '@/hooks/useRecipeAvailability';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import { useInventoryMovementsOffline } from '@/hooks/useInventoryMovements';

type ProductsTab = 'products' | 'inventory' | 'history';

type SearchType = 'all' | 'name' | 'id' | 'barcode' | 'category';

const Products: FC = () => {
  const { isRestaurant } = useBusinessType();
  const [activeTab, setActiveTab] = useState<ProductsTab>('products');
  const [historySearch, setHistorySearch] = useState('');
  const [historyUserSearch, setHistoryUserSearch] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showPrintLabelsDialog, setShowPrintLabelsDialog] = useState(false);

  // Carga de Stock con IA State
  const [isAIStockOpen, setIsAIStockOpen] = useState(false);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [isSavingAIStock, setIsSavingAIStock] = useState(false);
  const [extractedItems, setExtractedItems] = useState<Array<{
    id: string;
    tempName: string;
    productId: string;
    quantity: number;
    cost: number;
    taxPercentage: number;
    unitsPerBox: number;
    originalBoxQty?: number;
    originalBoxCost?: number;
    buyMode?: 'box' | 'unit';
  }>>([]);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreatePrice, setQuickCreatePrice] = useState(0);
  const [quickCreateCost, setQuickCreateCost] = useState(0);
  const [customTaxRate, setCustomTaxRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cobro_app_ai_stock_custom_tax_rate');
      return saved ? Number(saved) : 18;
    } catch (e) {
      return 18;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cobro_app_ai_stock_custom_tax_rate', String(customTaxRate));
    } catch (e) {
      console.error("Error saving custom tax rate to localStorage:", e);
    }
  }, [customTaxRate]);

  const [quickCreateTax, setQuickCreateTax] = useState(customTaxRate);
  const [quickCreateItemIdx, setQuickCreateItemIdx] = useState<number | null>(null);
  const [quickCreateBarcode, setQuickCreateBarcode] = useState('');
  const [prefilledFormValues, setPrefilledFormValues] = useState<Partial<Product> | null>(null);
  const [comboboxSearchTerm, setComboboxSearchTerm] = useState('');
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [openComboIdx, setOpenComboIdx] = useState<number | null>(null);
  const [aiTaxMessage, setAiTaxMessage] = useState<string | null>(null);
  const [aiIsTaxInclusive, setAiIsTaxInclusive] = useState<boolean>(false);

  const [isConfirmingSummary, setIsConfirmingSummary] = useState(false);
  // Quick Stock Edit State
  const [stockEditProduct, setStockEditProduct] = useState<Product | null>(null);
  const [stockEditValue, setStockEditValue] = useState<string>('');
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [showActiveOffers, setShowActiveOffers] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importData, setImportData] = useState<any[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const { data: products = [], isLoading, isFetching } = useProductsOffline();
  const { data: categories = [] } = useCategories();
  const deleteProduct = useDeleteProductOffline();
  const updateProduct = useUpdateProductOffline();
  const createProduct = useCreateProductOffline();
  const { data: movements = [], isLoading: isLoadingMovements } = useInventoryMovementsOffline();

  const filteredHistory = useMemo(() => {
    return movements.filter((mov: any) => {
      const productName = products.find(p => p.id === mov.product_id)?.name || mov.product_id;
      const matchProduct = productName.toLowerCase().includes(historySearch.toLowerCase());
      const matchUser = (mov.user_name || 'Sistema').toLowerCase().includes(historyUserSearch.toLowerCase());
      
      let matchDate = true;
      if (historyStartDate) {
        const start = new Date(historyStartDate);
        start.setHours(0, 0, 0, 0);
        const movDate = new Date(mov.created_at);
        matchDate = matchDate && movDate >= start;
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate);
        end.setHours(23, 59, 59, 999);
        const movDate = new Date(mov.created_at);
        matchDate = matchDate && movDate <= end;
      }
      
      return matchProduct && matchUser && matchDate;
    });
  }, [movements, products, historySearch, historyUserSearch, historyStartDate, historyEndDate]);
  const deleteAllProducts = useDeleteAllProducts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings: companySettings } = useCompanySettings();
  const { settings: storeSettings } = useStoreSettings();
  const { hasReachedLimit, getRemainingCount } = usePlanFeatures();
  const recipeAvailability = useRecipeAvailability();

  // State to track inline edits for products assigned in AI Stock Loading modal
  const [editingProductMap, setEditingProductMap] = useState<Record<string, {
    productId: string;
    name: string;
    stock: number;
    price: number;
    cost: number;
    barcode: string;
  }>>({});

  const [minimizedProductMap, setMinimizedProductMap] = useState<Record<string, boolean>>({});

  const toggleProductMinimize = (itemId: string) => {
    setMinimizedProductMap(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const updateProductMapField = (itemId: string, field: string, value: any) => {
    setEditingProductMap(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  useEffect(() => {
    setEditingProductMap(prev => {
      let updated = false;
      const nextMap = { ...prev };
      
      extractedItems.forEach(item => {
        if (item.productId && item.productId !== 'new-product') {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            if (!nextMap[item.id] || nextMap[item.id].productId !== item.productId) {
              nextMap[item.id] = {
                productId: item.productId,
                name: prod.name,
                stock: prod.stock || 0,
                price: prod.price || 0,
                cost: prod.cost || 0,
                barcode: prod.barcode || ''
              };
              updated = true;
            }
          }
        } else if (nextMap[item.id]) {
          delete nextMap[item.id];
          updated = true;
        }
      });
      
      return updated ? nextMap : prev;
    });
  }, [extractedItems, products]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem('cobro_app_ai_stock_items');
      const savedTaxMsg = localStorage.getItem('cobro_app_ai_stock_tax_message');
      const savedTaxInclusive = localStorage.getItem('cobro_app_ai_stock_tax_inclusive');
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExtractedItems(parsed);
        }
      }
      if (savedTaxMsg) {
        setAiTaxMessage(savedTaxMsg);
      }
      if (savedTaxInclusive !== null) {
        setAiIsTaxInclusive(savedTaxInclusive === 'true');
      }
    } catch (e) {
      console.error("Error reading AI stock draft from localStorage:", e);
    }
  }, []);

  // Save draft to localStorage when extractedItems, aiTaxMessage or aiIsTaxInclusive changes
  useEffect(() => {
    try {
      if (extractedItems.length > 0) {
        localStorage.setItem('cobro_app_ai_stock_items', JSON.stringify(extractedItems));
        if (aiTaxMessage) {
          localStorage.setItem('cobro_app_ai_stock_tax_message', aiTaxMessage);
        } else {
          localStorage.removeItem('cobro_app_ai_stock_tax_message');
        }
        localStorage.setItem('cobro_app_ai_stock_tax_inclusive', String(aiIsTaxInclusive));
      } else {
        localStorage.removeItem('cobro_app_ai_stock_items');
        localStorage.removeItem('cobro_app_ai_stock_tax_message');
        localStorage.removeItem('cobro_app_ai_stock_tax_inclusive');
      }
    } catch (e) {
      console.error("Error saving AI stock draft to localStorage:", e);
    }
  }, [extractedItems, aiTaxMessage, aiIsTaxInclusive]);

  const handleSaveProductEdit = async (itemId: string, productId: string) => {
    const editData = editingProductMap[itemId];
    const originalProd = products.find(p => p.id === productId);
    if (!editData || !originalProd) return;

    try {
      await updateProduct.mutateAsync({
        ...originalProd,
        name: editData.name,
        stock: editData.stock,
        price: editData.price,
        cost: editData.cost,
        barcode: editData.barcode,
        reason: 'Ajuste manual (Carga AI)'
      });
      toast({
        title: "Producto Actualizado",
        description: `Los datos de "${editData.name}" se han actualizado en inventario correctamente.`,
        className: "bg-emerald-50 text-emerald-900 border-emerald-200"
      });
      setMinimizedProductMap(prev => ({
        ...prev,
        [itemId]: true
      }));
    } catch (err) {
      console.error("Error al actualizar producto desde carga de IA:", err);
      toast({
        title: "Error al actualizar",
        description: "No se pudieron guardar los cambios en el producto.",
        variant: "destructive"
      });
    }
  };

  const cleanKey = (key: string | null | undefined) => {
    if (!key) return '';
    return key.trim();
  };

  const preprocessAIImage = async (file: File): Promise<string> => {
    let processableFile = file;

    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
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
        throw new Error("Error convirtiendo formato iPhone (HEIC).");
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(processableFile);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
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

  const handleAIStockUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const userKey = cleanKey(storeSettings?.ai_api_key);
    const systemKey = cleanKey(import.meta.env.VITE_GROQ_API_KEY);
    const apiKey = userKey || systemKey;

    if (!apiKey) {
      toast({
        title: "Requerido",
        description: "Configura primero tu clave de Groq en la sección de Contabilidad.",
        variant: "destructive"
      });
      return;
    }

    setIsAIScanning(true);
    try {
      const base64DataUrl = await preprocessAIImage(file);
      const base64Data = base64DataUrl.split(',')[1];
      const mimeType = base64DataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

      const prompt = `Analiza esta factura e identifica los productos comprados/abastecidos. Extrae estrictamente una lista en formato JSON plano con un arreglo "items" y los totales de la factura.
Cada item debe contener:
- name (string, nombre del producto tal como aparece en la factura. IMPORTANTE: Si el nombre contiene comillas dobles, quítalas o escápalas con barra invertida para que el JSON sea válido)
- quantity (número, cantidad de este producto tal como sale en la factura)
- cost (número, precio o costo unitario que sale en la factura antes de impuestos)
- unit (string, unidad de medida que sale en la factura al lado de la cantidad o en la columna de unidad, ej: "CAJA", "PAQUETE", "UNIDAD", "UND", o null si no se especifica)
- tax_percentage (número, ITBIS o tasa de impuesto aplicable a este producto, por ejemplo: 18, 16, 0, etc.)

Además, debes extraer los totales generales de la factura:
- invoice_subtotal (número, el subtotal neto de la factura sin impuestos/ITBIS)
- invoice_tax (número, el total de impuestos/ITBIS de la factura)
- invoice_total (número, el importe neto o total general final de la factura incluyendo impuestos)

Estructura requerida:
{
  "items": [
    { "name": "Producto A", "quantity": 10, "cost": 42.5, "unit": "CAJA", "tax_percentage": 18 }
  ],
  "invoice_subtotal": 1406.8,
  "invoice_tax": 253.22,
  "invoice_total": 1660.02
}
Responde únicamente con el objeto JSON plano sin texto introductorio ni explicaciones.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          response_format: { type: "json_object" },
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
        throw new Error(`Error en API Groq: ${response.status}`);
      }

      const resData = await response.json();
      let content = resData.choices?.[0]?.message?.content;
      if (!content) throw new Error("Respuesta vacía de Groq");

      let clean = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        clean = jsonMatch[0];
      }
      
      // Sanitizar comas sobrantes antes de cierres (trailing commas)
      clean = clean.replace(/,(\s*[\]}])/g, '$1');

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (err) {
        console.warn("Fallo inicial al parsear JSON, intentando corregir comillas internas...", err);
        try {
          const sanitized = clean.replace(/"name"\s*:\s*"([^"]*)"/g, (match, p1) => {
            const escaped = p1.replace(/"/g, "'");
            return `"name": "${escaped}"`;
          });
          parsed = JSON.parse(sanitized);
        } catch (innerErr) {
          throw new Error("La factura fue procesada, pero el formato JSON devuelto contenía errores de formato. Por favor, intenta de nuevo con otra foto.");
        }
      }
      const items = parsed.items || [];
      const extractedSubtotal = Number(parsed.invoice_subtotal || 0);
      const extractedTotal = Number(parsed.invoice_total || 0);

      // Calcular la suma de subtotales extraídos
      const sumSubtotals = items.reduce((acc: number, item: any) => acc + ((item.quantity || 1) * (item.cost || 0)), 0);

      // Validar si la factura incluye impuestos o no
      let isTaxInclusive = false;
      let cleanSubtotal = extractedSubtotal;
      let cleanTotal = extractedTotal;
      if (cleanSubtotal > cleanTotal && cleanTotal > 0) {
        cleanSubtotal = extractedTotal;
        cleanTotal = extractedSubtotal;
      }

      if (cleanTotal > 0 && cleanSubtotal > 0) {
        const diffToTotal = Math.abs(sumSubtotals - cleanTotal);
        const diffToSubtotal = Math.abs(sumSubtotals - cleanSubtotal);
        if (diffToTotal < diffToSubtotal) {
          isTaxInclusive = true;
        }
      } else if (cleanTotal > 0) {
        if (Math.abs(sumSubtotals - cleanTotal) < Math.abs(sumSubtotals * (1 + customTaxRate / 100) - cleanTotal)) {
          isTaxInclusive = true;
        }
      }

      setAiIsTaxInclusive(isTaxInclusive);

      let taxAlertMsg: string | null = null;
      if (isTaxInclusive) {
        taxAlertMsg = `✅ Impuestos Incluidos: Los precios de esta factura ya contienen el ITBIS.`;
      } else {
        const avgTaxPct = items.length > 0 ? (items.reduce((acc: number, item: any) => acc + (item.tax_percentage !== undefined && item.tax_percentage !== null ? item.tax_percentage : customTaxRate), 0) / items.length) : customTaxRate;
        taxAlertMsg = `⚠️ Impuestos Adicionados: Los precios de la factura NO incluyen ITBIS. Se ha sumado automáticamente el ${avgTaxPct.toFixed(0)}% de impuesto al costo de los productos.`;
      }
      setAiTaxMessage(taxAlertMsg);

      // Mapear automáticamente los nombres extraídos con los productos existentes
      const mapped = items.map((item: any) => {
        const matchingProduct = products.find((p: Product) => 
          p.name.toLowerCase().trim() === (item.name || '').toLowerCase().trim()
        );
        
        let parsedUnitsPerBox = 1;
        const nameMatch = (item.name || '').match(/(\d+)\s*\/\s*(\d+(\.\d+)?)/);
        if (nameMatch) {
          const val = parseInt(nameMatch[1], 10);
          if (!isNaN(val) && val > 0) parsedUnitsPerBox = val;
        }

        const parsedBoxQuantity = item.quantity || 1;
        const parsedBoxCost = item.cost || 0;

        const extractedUnit = (item.unit || '').toLowerCase().trim();
        const hasBoxUnit = extractedUnit.includes('caja') || extractedUnit.includes('paquete') || extractedUnit.includes('paq') || extractedUnit.includes('box') || extractedUnit.includes('cj') || extractedUnit.includes('pk');
        const hasExplicitUnit = extractedUnit.includes('unidad') || extractedUnit.includes('und') || extractedUnit.includes('pieza') || extractedUnit.includes('uni');
        
        let buyMode: 'box' | 'unit' = 'unit';
        if (hasBoxUnit) {
          buyMode = 'box';
        } else if (parsedUnitsPerBox > 1 && !hasExplicitUnit) {
          buyMode = 'box';
        }

        let unitCost = buyMode === 'box'
          ? parseFloat((parsedBoxCost / parsedUnitsPerBox).toFixed(2))
          : parsedBoxCost;

        // Si la factura NO incluye impuestos, se los agregamos al costo
        const hasTaxPercentage = item.tax_percentage !== undefined && item.tax_percentage !== null;
        const taxPercentage = hasTaxPercentage ? item.tax_percentage : customTaxRate;
        if (!isTaxInclusive) {
          unitCost = parseFloat((unitCost * (1 + taxPercentage / 100)).toFixed(2));
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          tempName: item.name || 'Desconocido',
          productId: matchingProduct?.id || 'new-product',
          quantity: parsedBoxQuantity,
          cost: unitCost,
          taxPercentage: taxPercentage,
          isDefaultTax: !hasTaxPercentage,
          unitsPerBox: parsedUnitsPerBox,
          originalBoxQty: parsedBoxQuantity,
          originalBoxCost: parsedBoxCost,
          buyMode: buyMode
        };
      });

      setExtractedItems(mapped);
      toast({
        title: "Lectura de Factura Exitosa",
        description: `Se detectaron ${mapped.length} productos para revisar.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error al escanear stock",
        description: err.message || "No se pudo procesar la imagen de la factura.",
        variant: "destructive"
      });
    } finally {
      setIsAIScanning(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  };

  const handleQuickCreateProduct = async () => {
    if (!quickCreateName.trim()) return;

    try {
      const newProd = await createProduct.mutateAsync({
        name: quickCreateName.trim(),
        price: quickCreatePrice,
        cost: quickCreateCost,
        tax_percentage: quickCreateTax,
        barcode: quickCreateBarcode.trim() || undefined,
        stock: 0,
        min_stock: 0,
        status: 'active',
        track_inventory: true
      });

      if (quickCreateItemIdx !== null && newProd) {
        setExtractedItems(prev => prev.map((item, idx) => 
          idx === quickCreateItemIdx ? { ...item, productId: newProd.id } : item
        ));
      }

      setIsQuickCreateOpen(false);
      setQuickCreateName('');
      setQuickCreatePrice(0);
      setQuickCreateCost(0);
      setQuickCreateTax(customTaxRate);
      setQuickCreateBarcode('');
      setComboboxSearchTerm('');
      setQuickCreateItemIdx(null);

      toast({
        title: "Producto Creado",
        description: "El nuevo producto ha sido agregado al catálogo y seleccionado en la fila.",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error al crear",
        description: err.message || "No se pudo crear el producto.",
        variant: "destructive"
      });
    }
  };

  const handleConfirmAIStock = async () => {
    if (extractedItems.length === 0) return;

    const hasUnmapped = extractedItems.some(i => i.productId === 'new-product' || !i.productId);
    if (hasUnmapped) {
      toast({
        title: "Productos no asignados",
        description: "Asigna todos los productos o regístralos como 'Nuevos' antes de guardar.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingAIStock(true);
    try {
      let updatedCount = 0;

      for (const item of extractedItems) {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const isBox = (item.buyMode || 'box') === 'box';
          const addedStock = isBox 
            ? Number(item.quantity) * Number(item.unitsPerBox || 1)
            : Number(item.quantity);
          const currentStock = Number(prod.stock || 0);
          const newStock = currentStock + addedStock;
          const unitCost = Number(item.cost);
          
          await updateProduct.mutateAsync({
            ...prod,
            stock: newStock,
            cost: unitCost,
            tax_percentage: Number(item.taxPercentage),
            reason: 'Carga de Stock con IA (Factura)'
          });
          updatedCount++;
        }
      }

      toast({
        title: "Stock Cargado Correctamente",
        description: `Se actualizaron ${updatedCount} productos con éxito.`,
        className: "bg-green-50 text-green-900 border-green-200"
      });
      setIsAIStockOpen(false);
      setExtractedItems([]);
      setIsConfirmingSummary(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error al actualizar inventario",
        description: err.message || "Ocurrió un error al guardar los stocks.",
        variant: "destructive"
      });
    } finally {
      setIsSavingAIStock(false);
    }
  };

  // Cálculos detallados del valor del inventario — memoizados para evitar recalcular en cada render
  const inventoryStats = useMemo(() => products.reduce((acc, product) => {
    let costWithoutTax = product.cost || 0;
    let costWithTax = product.cost || 0;
    const stock = Number(product.stock || 0);
    const price = Number(product.price || 0);
    
    // Si tax_percentage es exactamente 0, taxRate es 0. 
    // Si es null/undefined, usamos 0.18 por defecto.
    const taxRate = (product.tax_percentage !== null && product.tax_percentage !== undefined) 
      ? (product.tax_percentage / 100) 
      : 0.18;

    if (product.cost_includes_tax) {
      costWithoutTax = costWithTax / (1 + taxRate);
    } else {
      costWithTax = costWithoutTax * (1 + taxRate);
    }

    acc.costoSinImpuesto += costWithoutTax * stock;
    acc.costoConImpuesto += costWithTax * stock;
    acc.valorEnPrecio += price * stock;

    return acc;
  }, { costoSinImpuesto: 0, costoConImpuesto: 0, valorEnPrecio: 0 }), [products]);

  // Contar productos con stock bajo — memoizado
  const lowStockProducts = useMemo(() => products.filter(p => {
    // Excluir productos que no controlan inventario
    if (p.track_inventory === false) return false;

    const currentStock = p.stock || 0;
    const minStock = p.min_stock || 0;
    // Solo alertar si el producto controla inventario Y tiene stock bajo
    return currentStock <= minStock;
  }), [products]);
  const lowStockCount = lowStockProducts.length;

  // Función para descargar planilla de ejemplo
  const handleDownloadTemplate = () => {
    const headers = [
      ['Nombre', 'Precio', 'Costo', 'Stock', 'Stock Mínimo', 'Código de Barras', 'Código Interno', 'Categoría', 'Estado', 'Impuesto(%)', 'Costo Incluye Impuesto'],
      ['Ejemplo Producto', '100.00', '80.00', '50', '10', '7441000000000', 'PROD001', 'General', 'active', '18', 'No']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, "plantilla_productos.xlsx");
  };

  // Función para eliminar todos los productos
  const handleDeleteAll = async () => {
    if (products.length === 0) return;

    if (window.confirm("⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? \n\nEsta acción eliminará TODOS los productos del inventario permanentemente. No se puede deshacer.")) {
      // Doble confirmación
      const confirmText = prompt("Para confirmar, escribe 'ELIMINAR' en mayúsculas:");
      if (confirmText === 'ELIMINAR') {
        try {
          await deleteAllProducts.mutateAsync();
          toast({
            title: "Inventario eliminado",
            description: "Todos los productos han sido eliminados correctamente.",
            variant: "destructive"
          });
        } catch (error: any) {
          console.error("Error deleting all:", error);

          // Mostrar mensaje amigable si es por Foreign Key
          let message = error.message || "No se pudieron eliminar los productos.";
          if (message.includes("foreign key") || message.includes("constraint")) {
            message = "No se pueden eliminar productos que tienen ventas, movimientos o pedidos asociados. Debes eliminar esos registros primero.";
          }

          toast({
            title: "Error al eliminar",
            description: message,
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    }
  };

  const handleQuickStockSave = async () => {
    if (!stockEditProduct) return;
    const newStock = parseFloat(stockEditValue);

    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: "Stock Inválido",
        description: "El stock debe ser un número mayor o igual a 0.",
        variant: "destructive"
      });
      return;
    }

    if (newStock === stockEditProduct.stock) {
      setStockEditProduct(null);
      return;
    }

    // Confirmation
    if (!window.confirm(`¿Estás seguro que deseas actualizar el stock de "${stockEditProduct.name}" de ${stockEditProduct.stock || 0} a ${newStock}?`)) {
      return;
    }

    setIsUpdatingStock(true);
    try {
      // Usar la mutación offline para que actualice de inmediato IndexedDB y el caché de forma optimista
      await updateProduct.mutateAsync({
        ...stockEditProduct,
        stock: newStock,
        reason: 'Ajuste rápido de inventario'
      });

      toast({
        title: "Stock Actualizado",
        description: `El stock de ${stockEditProduct.name} ha sido actualizado correctamente.`,
        className: "bg-green-50 text-green-900 border-green-200"
      });

      setStockEditProduct(null);
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast({
        title: "Error al actualizar",
        description: error.message || "Ocurrió un error al guardar el stock.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Función para importar CSV/Excel
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        throw new Error("El archivo está vacío");
      }

      const headers = Object.keys(jsonData[0]);
      setImportHeaders(headers);
      setImportData(jsonData);
      setShowImportDialog(true);

    } catch (error: any) {
      console.error('Error reading file:', error);
      toast({
        title: "Error al leer el archivo",
        description: error.message || "No se pudo procesar el archivo.",
        variant: "destructive"
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async (mapping: Record<string, string>, strategy: 'skip' | 'overwrite') => {
    setShowImportDialog(false);
    setIsImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle();
      const storeId = profile?.store_id;

      const categoryMap = new Map<string, string>();
      categories.forEach(c => {
        if (c.name) categoryMap.set(c.name.toLowerCase().trim(), c.id);
      });

      const inserts: any[] = [];
      const updates: any[] = [];
      const skipped: string[] = [];
      
      for (const row of importData) {
        const name = row[mapping['name']];
        const priceStr = row[mapping['price']];

        if (!name || isNaN(parseFloat(priceStr))) continue;

        const nameLower = name.toString().toLowerCase().trim();
        const barcode = mapping['barcode'] ? (row[mapping['barcode']] || '').toString().trim() : '';

        // Check existence
        const existingProduct = products.find(p => 
          p.name?.toLowerCase().trim() === nameLower || 
          (barcode && (p.barcode || '').toString().trim() === barcode)
        );

        // Omitir si ya hay un producto con el mismo nombre o código de barras en ESTE mismo lote (duplicados dentro del archivo)
        const duplicateInInserts = inserts.find(i => 
          i.name?.toLowerCase().trim() === nameLower || 
          (barcode && i.barcode === barcode)
        );

        const duplicateInUpdates = updates.find(u => 
          u.name?.toLowerCase().trim() === nameLower || 
          (barcode && u.barcode === barcode)
        );

        if (duplicateInInserts || duplicateInUpdates) {
          skipped.push(name);
          continue;
        }

        const categoryName = mapping['category'] ? row[mapping['category']] : '';
        let categoryId = null;
        if (categoryName) {
          const normalized = categoryName.toString().toLowerCase().trim();
          categoryId = categoryMap.get(normalized) || null;
        }

        const productData = {
          name,
          price: parseFloat(priceStr),
          cost: mapping['cost'] ? parseFloat(row[mapping['cost']] || '0') : 0,
          stock: mapping['stock'] ? parseFloat(row[mapping['stock']] || '0') : 0,
          min_stock: mapping['min_stock'] ? parseFloat(row[mapping['min_stock']] || '0') : 0,
          barcode: barcode || null,
          internal_code: mapping['internal_code'] ? (row[mapping['internal_code']] || '').toString().trim() : null,
          category_id: categoryId,
          store_id: storeId,
          status: mapping['status'] ? (row[mapping['status']] === 'inactive' ? 'inactive' : 'active') : 'active',
          tax_percentage: mapping['tax_percentage'] ? parseFloat(row[mapping['tax_percentage']] || '0') : 0,
          cost_includes_tax: mapping['cost_includes_tax'] 
            ? ['si', 'yes', 'true', '1'].includes((row[mapping['cost_includes_tax']] || '').toString().toLowerCase().trim()) 
            : false
        };

        if (existingProduct) {
          if (strategy === 'skip') {
            skipped.push(name);
            continue;
          } else {
            updates.push({ id: existingProduct.id, ...productData });
          }
        } else {
          inserts.push(productData);
        }
      }

      let completedActions = 0;
      const totalActions = updates.length + inserts.length;
      setImportProgress(0);

      const BATCH_SIZE = 100;

      // Execute Updates in Batches
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 10) {
          const batch = updates.slice(i, i + 10);
          await Promise.all(batch.map(item => {
            const { id, ...data } = item;
            return supabase.from('products').update(data).eq('id', id);
          }));
          completedActions += batch.length;
          const progress = Math.round((completedActions / totalActions) * 100);
          setImportProgress(progress > 100 ? 100 : progress);
        }
      }

      // Execute Inserts in Batches
      if (inserts.length > 0) {
        for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
          const batch = inserts.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('products').insert(batch);
          if (error) throw error;
          completedActions += batch.length;
          const progress = Math.round((completedActions / totalActions) * 100);
          setImportProgress(progress > 100 ? 100 : progress);
        }
      }

      setImportProgress(null);
      toast({
        title: "Importación exitosa",
        description: `Creados: ${inserts.length}, Actualizados: ${updates.length}, Omitidos: ${skipped.length}`,
        className: "bg-green-50 text-green-900 border-green-200"
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });

    } catch (error: any) {
      console.error('Error importing:', error);
      toast({
        title: "Error al importar",
        description: error.message || "Ocurrió un error al procesar la importación.",
        variant: "destructive"
      });
    } finally {
      setImportProgress(null);
      setIsImporting(false);
    }
  };

  // Función para imprimir lista de compras
  const handlePrintShoppingList = () => {
    const businessName = companySettings?.company_name || "MI NEGOCIO";
    const rnc = companySettings?.rnc || "N/A";
    const phone = companySettings?.phone || "N/A";

    const date = new Date().toLocaleDateString('es-DO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Compras - Stock Bajo</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
          .title { background: #f0f0f0; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 15px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .app-watermark { 
            margin-top: 20px; 
            padding-top: 15px; 
            border-top: 1px dotted #ccc;
            display: flex; 
            justify-content: center; 
            align-items: center; 
            gap: 8px; 
            opacity: 0.5; 
          }
          .app-watermark img { 
            height: 16px; 
            width: auto; 
            filter: grayscale(100%); 
          }
          .app-watermark span { 
            font-size: 11px; 
            font-weight: 600; 
            color: #999; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
          }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${businessName}</h1>
          <p>RNC: ${rnc} | Tel: ${phone}</p>
        </div>
        <div class="info">
          <div><strong>Fecha:</strong> ${date}</div>
          <div><strong>Total de productos:</strong> ${lowStockProducts.length}</div>
        </div>
        <div class="title">📋 LISTA DE COMPRAS - PRODUCTOS CON STOCK BAJO</div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 40%">Producto</th>
              <th style="width: 20%">Categoría</th>
              <th class="text-center" style="width: 15%">Stock Actual</th>
              <th class="text-center" style="width: 10%">Mínimo</th>
              <th class="text-right" style="width: 10%">Costo Unit.</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockProducts.map((product, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${product.name}</td>
                <td>${product.category?.name || 'Sin categoría'}</td>
                <td class="text-center" style="color: red; font-weight: bold;">${product.stock}</td>
                <td class="text-center">${product.min_stock}</td>
                <td class="text-right">$${(product.cost || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleString('es-DO')}</p>
          <div class="app-watermark">
            <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/cobro-logo.png" alt="Cobro">
            <span>Cobro</span>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 250);
    }
  };

  // filteredProducts memoizado — solo recalcula cuando cambian los filtros (búsqueda con debounce)
  const filteredProducts = useMemo(() => products.filter(product => {
    // Filtro por stock bajo
    if (showLowStockOnly && !((product.stock || 0) <= (product.min_stock || 0))) {
      return false;
    }

    // Filtro por categoría
    if (selectedCategory !== 'all' && product.category_id !== selectedCategory) {
      return false;
    }

    // Si no hay término de búsqueda, mostrar todos (con filtro de categoría aplicado)
    if (!debouncedSearchTerm.trim()) {
      return true;
    }

    // Filtro según tipo de búsqueda
    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    switch (searchType) {
      case 'all': {
        const nameMatch = product.name && product.name.toLowerCase().includes(searchLower);
        const idMatch = product.internal_code && product.internal_code.toLowerCase().includes(searchLower);
        const categoryMatch = product.category?.name && product.category.name.toLowerCase().includes(searchLower);
        const allBarcodes = [
          product.barcode?.toLowerCase(),
          ...(product.barcodes?.map(b => b.barcode.toLowerCase()) ?? []),
        ].filter(Boolean) as string[];
        const barcodeMatch = allBarcodes.some(b => b.includes(searchLower));
        
        return nameMatch || idMatch || categoryMatch || barcodeMatch;
      }
      case 'name':
        return product.name && product.name.toLowerCase().includes(searchLower);
      case 'id':
        return product.internal_code && product.internal_code.toLowerCase().includes(searchLower);
      case 'barcode': {
        const allBarcodes = [
          product.barcode?.toLowerCase(),
          ...(product.barcodes?.map(b => b.barcode.toLowerCase()) ?? []),
        ].filter(Boolean) as string[];
        return allBarcodes.some(b => b.includes(searchLower));
      }
      case 'category':
        return product.category?.name && product.category.name.toLowerCase().includes(searchLower);
      default:
        return true;
    }
  }), [products, showLowStockOnly, selectedCategory, debouncedSearchTerm, searchType]);

  // Reset pagination when filters change (usar debouncedSearchTerm para consistencia con el filtro)
  useEffect(() => {
    setVisibleCount(50);
  }, [debouncedSearchTerm, searchType, selectedCategory, showLowStockOnly]);

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  }, []);

  const handleOpenLabels = useCallback(() => setShowPrintLabelsDialog(true), []);

  const handleDelete = async (product: Product) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?`)) {
      try {
        await deleteProduct.mutateAsync(product.id);
        toast({
          title: "Producto eliminado",
          description: "El producto se ha eliminado correctamente.",
        });
      } catch (error: any) {
        console.error('Error al eliminar producto:', error);

        let message = "No se pudo eliminar el producto. Inténtalo de nuevo.";

        if (error.message === 'FALTA_SQL' || error === 'FALTA_SQL') {
          message = "Por favor, ejecuta el script SQL '7_FIX_ELIMINAR_PRODUCTOS.sql' en Supabase para habilitar la eliminación de productos con historial.";
        }
        // Check for common foreign key constraint errors
        else if (error.message?.includes("foreign key") || error.message?.includes("constraint") || error.code === '23503') {
          message = "No se puede eliminar este producto porque tiene historial de ventas o movimientos. Te recomendamos cambiar su estado a 'Inactivo' en lugar de eliminarlo.";
        }

        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: message,
        });
      }
    }
  };

  const handleToggleTaxInclusive = (newValue: boolean) => {
    setAiIsTaxInclusive(newValue);
    
    // Recalcular los costos de los productos extraídos
    setExtractedItems(prev => prev.map(item => {
      const currentSub = item.subtotal !== undefined ? item.subtotal : parseFloat((item.quantity * item.cost * (item.buyMode === 'box' ? (item.unitsPerBox || 1) : 1)).toFixed(2));
      const totalUnits = item.quantity * (item.buyMode === 'box' ? (item.unitsPerBox || 1) : 1);
      const taxPercentage = item.taxPercentage !== undefined ? item.taxPercentage : customTaxRate;
      const baseCost = totalUnits > 0 ? currentSub / totalUnits : 0;
      const finalCost = newValue ? baseCost : (baseCost * (1 + taxPercentage / 100));

      return {
        ...item,
        subtotal: currentSub,
        cost: parseFloat(finalCost.toFixed(4))
      };
    }));

    // Actualizar el mensaje de alerta
    if (newValue) {
      setAiTaxMessage(`✅ Impuestos Incluidos: Los precios de esta factura ya contienen el ITBIS.`);
    } else {
      setAiTaxMessage(`⚠️ Impuestos Adicionados: Los precios de la factura NO incluyen ITBIS. Se ha sumado automáticamente el ${customTaxRate}% de impuesto al costo de los productos.`);
    }
  };

  const handleCustomTaxRateChange = (newRate: number) => {
    setCustomTaxRate(newRate);
    
    setExtractedItems(prev => prev.map(item => {
      if (!item.isDefaultTax) return item;

      const currentSub = item.subtotal !== undefined ? item.subtotal : parseFloat((item.quantity * item.cost * (item.buyMode === 'box' ? (item.unitsPerBox || 1) : 1)).toFixed(2));
      const totalUnits = item.quantity * (item.buyMode === 'box' ? (item.unitsPerBox || 1) : 1);
      const baseCost = totalUnits > 0 ? currentSub / totalUnits : 0;
      const finalCost = aiIsTaxInclusive ? baseCost : (baseCost * (1 + newRate / 100));

      return {
        ...item,
        taxPercentage: newRate,
        cost: parseFloat(finalCost.toFixed(4)),
        subtotal: currentSub
      };
    }));
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setPrefilledFormValues(null);
    setQuickCreateItemIdx(null);
  };

  const handleFormSuccess = () => {
    // La query se invalidará automáticamente por el hook
  };

  const handleProductFormSuccess = (newProduct?: Product) => {
    if (quickCreateItemIdx !== null && newProduct) {
      setExtractedItems(prev => prev.map((item, idx) => 
        idx === quickCreateItemIdx ? { ...item, productId: newProduct.id } : item
      ));
      setQuickCreateItemIdx(null);
      setPrefilledFormValues(null);
      setComboboxSearchTerm('');
    }
    handleFormSuccess();
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay productos",
        description: "No hay productos para exportar.",
      });
      return;
    }

    // Crear headers del CSV
    const headers = [
      'Nombre',
      'Código de Barras',
      'Categoría',
      'Precio',
      'Costo',
      'Stock',
      'Stock Mínimo',
      'Estado'
    ];

    // Convertir productos a filas CSV
    const csvData = products.map(product => [
      product.name,
      product.barcode || '',
      product.category?.name || '',
      product.price.toString(),
      (product.cost || 0).toString(),
      product.stock.toString(),
      product.min_stock.toString(),
      product.status
    ]);

    // Combinar headers y datos
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Productos exportados",
      description: `Se han exportado ${products.length} productos a CSV.`,
    });
  };


  if (isLoading || (products.length === 0 && isFetching)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <LoadingLogo text="Cargando productos..." size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Inventario
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Gestión de Catálogo y Stock
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-3xl px-4">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95"
            onClick={() => {
              if (hasReachedLimit('products', products.length)) {
                setShowLimitDialog(true);
              } else {
                setShowForm(true);
              }
            }}
          >
            <Plus className="h-5 w-5" />
            Nuevo Producto
          </Button>

          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-blue-500/20 gap-3 transition-all active:scale-95"
            onClick={() => setIsAIStockOpen(true)}
          >
            <Sparkles className="h-5 w-5 text-blue-200" />
            Stock con IA
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-border/50 bg-muted/10 font-bold uppercase text-[10px] tracking-widest">
                <Upload className="mr-2 h-4 w-4" />
                Acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="rounded-2xl p-2 min-w-[200px]">
              <DropdownMenuItem onSelect={handleImportClick} disabled={isImporting} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider">
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Importar CSV/Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownloadTemplate} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider">
                <Download className="mr-2 h-4 w-4" />
                Descargar Plantilla
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportCSV} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider">
                <Download className="mr-2 h-4 w-4" />
                Exportar Productos
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpenLabels} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Etiquetas
              </DropdownMenuItem>
              {products.length > 0 && (
                <DropdownMenuItem onSelect={handleDeleteAll} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Todo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className="h-14 w-14 rounded-2xl border-border/50 bg-muted/10"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] });
              toast({ title: "Actualizando...", description: "Sincronizando inventario..." });
            }}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Centered Tab Selector */}
      <div className="flex justify-center mb-6 w-full px-2">
        <div className="flex items-center gap-1 p-1 bg-muted/20 border border-border/30 rounded-2xl backdrop-blur-sm overflow-x-auto no-scrollbar max-w-full flex-nowrap">
          <Button
            variant={activeTab === 'products' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('products')}
            className={cn(
              "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest shrink-0",
              activeTab === 'products' && "bg-background shadow-lg"
            )}
          >
            <Package className="mr-2 h-3.5 w-3.5" />
            Catálogo
          </Button>
          {isRestaurant && (
            <Button
              variant={activeTab === 'inventory' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest shrink-0",
                activeTab === 'inventory' && "bg-background shadow-lg"
              )}
            >
              <FlaskConical className="mr-2 h-3.5 w-3.5" />
              Materia Prima
            </Button>
          )}
          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('history')}
            className={cn(
              "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest shrink-0",
              activeTab === 'history' && "bg-background shadow-lg"
            )}
          >
            <History className="mr-2 h-3.5 w-3.5" />
            Historial de Cambios
          </Button>
        </div>
      </div>

      {/* ─── Pestaña: Control de Inventario (solo restaurante) ─── */}
      {isRestaurant && activeTab === 'inventory' && (
        <RestaurantInventoryControl />
      )}

      {/* ─── Pestaña: Productos ─── */}
      {activeTab === 'products' && (
        <>

      {/* Estadísticas del inventario */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Valor del inventario */}
        <Card className="bg-card/60 backdrop-blur-xl border border-border/50 hover:border-emerald-500/30 hover:bg-card/80 transition-all duration-500 overflow-hidden relative group rounded-3xl shadow-sm hover:shadow-emerald-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-center h-full gap-5">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors duration-500">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Previsión de Venta</p>
                <p className="text-3xl font-black tracking-tighter text-emerald-500 flex items-baseline gap-0.5">
                  <span className="text-xl font-bold opacity-80">$</span>
                  {inventoryStats.valorEnPrecio.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground/60 mb-1">Costo (Sin Imp)</p>
                <p className="text-sm font-semibold opacity-90">
                  ${inventoryStats.costoSinImpuesto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground/60 mb-1">Costo (Con Imp)</p>
                <p className="text-sm font-semibold opacity-90">
                  ${inventoryStats.costoConImpuesto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total de productos */}
        <Card className="bg-card/60 backdrop-blur-xl border border-border/50 hover:border-blue-500/30 hover:bg-card/80 transition-all duration-500 overflow-hidden relative group rounded-3xl shadow-sm hover:shadow-blue-500/10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <CardContent className="p-6 relative z-10 flex flex-col justify-center h-full gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors duration-500">
                <Package className="h-6 w-6 text-blue-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Total Productos</p>
                <p className="text-4xl font-black tracking-tighter text-blue-500">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productos con stock bajo */}
        <Card
          className={`backdrop-blur-xl transition-all duration-500 overflow-hidden relative group rounded-3xl cursor-pointer shadow-sm ${
            showLowStockOnly
            ? 'bg-destructive/10 border-destructive/30 ring-1 ring-destructive/50 shadow-[0_4px_20px_rgba(239,68,68,0.15)]'
            : 'bg-card/60 border-border/50 hover:border-destructive/30 hover:bg-card/80 hover:shadow-destructive/10 border'
          }`}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <div className={`absolute inset-0 bg-gradient-to-br from-destructive/10 via-transparent to-transparent transition-opacity duration-700 ${showLowStockOnly ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          <CardContent className="p-6 relative z-10 flex flex-col justify-center h-full gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-4 rounded-2xl border transition-colors duration-500 ${showLowStockOnly ? 'bg-destructive/20 border-destructive/30' : 'bg-destructive/10 border-destructive/20 group-hover:bg-destructive/20'}`}>
                  <AlertTriangle className={`h-6 w-6 text-destructive ${showLowStockOnly ? 'animate-pulse' : ''}`} />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 truncate">
                    Stock Bajo {showLowStockOnly && <span className="text-destructive font-bold ml-1">(Filtrado)</span>}
                  </p>
                  <p className="text-4xl font-black tracking-tighter text-destructive">{lowStockCount}</p>
                </div>
              </div>
              {showLowStockOnly && lowStockCount > 0 && (
                <div className="pl-4 border-l border-destructive/20 h-full flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl border-destructive/30 bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintShoppingList();
                    }}
                    title="Imprimir lista de compra"
                  >
                    <Printer className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Botones de tipo de búsqueda */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Button
                variant={searchType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('all')}
                className="flex items-center justify-center gap-2"
              >
                <Asterisk className="h-4 w-4" />
                <span>Todo</span>
              </Button>
              <Button
                variant={searchType === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('name')}
                className="flex items-center justify-center gap-2"
              >
                <Package className="h-4 w-4" />
                <span>Nombre</span>
              </Button>
              <Button
                variant={searchType === 'barcode' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('barcode')}
                className="flex items-center justify-center gap-2"
              >
                <Barcode className="h-4 w-4" />
                <span>Código de barras</span>
              </Button>
              <Button
                variant={searchType === 'id' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('id')}
                className="flex items-center justify-center gap-2"
              >
                <Hash className="h-4 w-4" />
                <span>Código interno</span>
              </Button>
              <Button
                variant={searchType === 'category' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('category')}
                className="flex items-center justify-center gap-2"
              >
                <Tag className="h-4 w-4" />
                <span>Categoría</span>
              </Button>
            </div>

            {/* Barra de búsqueda y filtro de categoría */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'all' ? 'Buscar por cualquier campo...' :
                      searchType === 'name' ? 'Buscar por nombre...' :
                        searchType === 'barcode' ? 'Buscar por código de barras...' :
                          searchType === 'id' ? 'Buscar por código interno...' :
                            'Buscar por categoría...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro de categoría */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <div className="grid grid-cols-1 gap-4">
        {filteredProducts.slice(0, visibleCount).map((product) => (
          // ProductCard es memoizado — solo re-renderiza si el producto cambia
          <Card key={product.id} className="group overflow-hidden hover:shadow-md transition-all duration-200 border-border/50">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
                {/* Imagen */}
                <div className="h-24 w-24 sm:h-20 sm:w-20 bg-muted/30 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-border/50 group-hover:border-primary/20 transition-colors">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('bg-muted');
                        const icon = document.createElement('div');
                        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-muted-foreground/30"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                        e.currentTarget.parentElement?.appendChild(icon.firstChild!);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>

                {/* Info Principal */}
                <div className="flex-1 min-w-0 space-y-2 w-full text-center sm:text-left">
                  <div className="flex flex-col gap-2">
                    <h3 className="font-bold text-base sm:text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2" title={product.name}>{product.name}</h3>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
                      <Badge variant="secondary" className="bg-secondary/60 hover:bg-secondary/80 text-[10px] px-2 py-0.5 font-medium transition-colors">{product.category?.name || 'Sin categoría'}</Badge>
                      {product.track_inventory === false ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] px-2 py-0.5 font-medium">Sin stock</Badge>
                      ) : ((product.stock || 0) <= (product.min_stock || 0)) && (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 text-[10px] px-2 py-0.5 font-medium">Stock Bajo</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 opacity-70 font-mono">
                    <Barcode className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="truncate">{product.barcode || 'Sin código'}</span>
                  </p>
                </div>

                {/* Precios, Stock y Acciones (Grid en móvil, Flex en desktop) */}
                <div className="flex w-full sm:w-auto shrink-0 flex-col sm:flex-row sm:items-center sm:gap-6 bg-secondary/10 sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border border-border/50 sm:border-0 mt-3 sm:mt-0 shadow-inner sm:shadow-none">
                  
                  {/* Fila 1 (Móvil): Precios | Fila/Col (Desktop) */}
                  <div className="flex justify-between items-center sm:flex-col sm:items-end gap-1 w-full sm:w-auto">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider sm:hidden">Precio</span>
                      <span className="text-2xl font-black text-primary">${product.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Costo</span>
                        <span className="text-sm font-semibold text-muted-foreground/80">${(product.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {/* Ganancia / Margen */}
                      {product.price > (product.cost || 0) && (product.cost || 0) > 0 && (
                        <div className="flex items-center justify-end">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            RD${(product.price - (product.cost || 0)).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            {' '}<span className="opacity-70 text-[9px]">({(((product.price - (product.cost || 0)) / (product.cost || 1)) * 100).toFixed(0)}%)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Separador Desktop */}
                  <div className="hidden sm:block h-12 w-px bg-border/50 mx-2"></div>

                  {/* Fila 2 (Móvil): Stock y Mínimo | Col (Desktop) */}
                  <div className="flex justify-between items-center sm:flex-col sm:items-start gap-3 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-border/50 sm:border-t-0">
                    
                    {recipeAvailability.has(product.id) ? (() => {
                        const available = recipeAvailability.get(product.id)!;
                        return (
                          <div className="flex flex-col gap-1 w-1/2 sm:w-auto">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider hidden sm:block">Inventario</span>
                            <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${
                              available === 0
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : available <= 3
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            }`}>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black">{available}</span>
                                <span className="text-[10px] font-bold opacity-70">disp.</span>
                              </div>
                              <span className="text-[9px] font-semibold uppercase opacity-80 mt-0.5 flex items-center gap-1"><ChefHat className="h-3 w-3" /> Por receta</span>
                            </div>
                          </div>
                        );
                    })() : (
                      <div className="flex flex-col gap-1 w-[55%] sm:w-auto">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider hidden sm:block mb-1">Inventario</span>
                        <button
                          onClick={() => {
                            setStockEditProduct(product);
                            setStockEditValue(product.stock?.toString() || '0');
                          }}
                          className="group/stock relative flex flex-col items-center justify-center bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary py-2.5 px-2 sm:p-2 rounded-2xl transition-all active:scale-95 overflow-hidden w-full"
                        >
                          <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-3xl font-black leading-none tracking-tighter">{product.stock ?? 0}</span>
                            <span className="text-xs font-bold opacity-70">uds</span>
                          </div>
                          <div className="text-[10px] font-bold uppercase opacity-80 mt-1.5 flex items-center gap-1.5 text-primary/80 group-hover/stock:text-primary relative z-10">
                            <Pencil className="h-3 w-3" /> <span className="sm:hidden">Editar Stock</span><span className="hidden sm:inline">Editar</span>
                          </div>
                          {/* Hover effect background */}
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/stock:opacity-100 transition-opacity"></div>
                        </button>
                      </div>
                    )}
                    
                    <div className="flex flex-col items-end sm:items-start justify-center gap-3 w-[40%] sm:w-auto">
                      {/* Acciones */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleEdit(product)} 
                          className="h-11 w-11 sm:h-9 sm:w-9 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 bg-background sm:bg-transparent rounded-xl transition-colors border-border/50 shadow-sm sm:shadow-none"
                        >
                          <Edit className="h-5 w-5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(product)}
                          disabled={deleteProduct.isPending}
                          className="h-11 w-11 sm:h-9 sm:w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 bg-background sm:bg-transparent rounded-xl transition-colors border-border/50 shadow-sm sm:shadow-none"
                        >
                          <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                      {!recipeAvailability.has(product.id) && (
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1 sm:mt-0">Mínimo: {product.min_stock}</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Botón Cargar Más */}
      {visibleCount < filteredProducts.length && (
        <div className="flex justify-center mt-6">
          <Button 
            variant="outline" 
            onClick={() => setVisibleCount(prev => prev + 50)} 
            className="rounded-xl px-10 h-12 font-bold tracking-widest uppercase text-xs border-border/50 bg-card hover:bg-muted/50 hover:text-primary transition-colors"
          >
            Cargar Más Productos
          </Button>
        </div>
      )}

        </> /* end products tab */ )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filtros de búsqueda para Historial */}
          <Card className="bg-card/60 backdrop-blur-xl border border-border/50 shadow-sm rounded-3xl">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre de producto..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-10 rounded-2xl h-11 border-border/50 focus-visible:ring-primary/20 bg-background/50"
                    />
                  </div>
                  <div className="w-full md:w-[300px] relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar por usuario..."
                      value={historyUserSearch}
                      onChange={(e) => setHistoryUserSearch(e.target.value)}
                      className="pl-10 rounded-2xl h-11 border-border/50 focus-visible:ring-primary/20 bg-background/50"
                    />
                  </div>
                </div>
                
                {/* Filtro de Fecha */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-border/10">
                  <div className="w-full sm:w-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtrar por Fecha:</div>
                  <div className="grid grid-cols-2 gap-4 w-full sm:w-auto sm:flex sm:items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Desde</span>
                      <Input
                        type="date"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="rounded-xl h-9 text-xs border-border/50 focus-visible:ring-primary/20 bg-background/50 w-full sm:w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Hasta</span>
                      <Input
                        type="date"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="rounded-xl h-9 text-xs border-border/50 focus-visible:ring-primary/20 bg-background/50 w-full sm:w-[150px]"
                      />
                    </div>
                  </div>
                  {(historyStartDate || historyEndDate) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setHistoryStartDate('');
                        setHistoryEndDate('');
                      }}
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl px-3 h-8 ml-auto sm:ml-4"
                    >
                      Limpiar Fechas
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla / Lista de movimientos */}
          {isLoadingMovements ? (
            <Card className="border border-border/30 bg-card/60 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Cargando historial de inventario...</p>
            </Card>
          ) : filteredHistory.length === 0 ? (
            <Card className="border border-border/30 bg-card/60 backdrop-blur-md rounded-3xl p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No se encontraron registros</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                No hay movimientos de inventario registrados que coincidan con la búsqueda.
              </p>
            </Card>
          ) : (
            <Card className="border border-border/50 bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Producto</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Usuario</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha / Hora</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Ajuste</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Anterior</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Nuevo Stock</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detalle / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredHistory.map((mov: any) => {
                      const prod = products.find(p => p.id === mov.product_id);
                      const productName = prod ? prod.name : 'Producto Eliminado';
                      const isPositive = mov.quantity_changed > 0;
                      
                      return (
                        <tr key={mov.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-4 px-6">
                            <span className="font-bold text-sm text-foreground">{productName}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm font-medium text-muted-foreground">{mov.user_name || 'Sistema'}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-muted-foreground">
                              {new Date(mov.created_at).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black",
                              isPositive 
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                                : "bg-destructive/10 text-destructive border border-destructive/20"
                            )}>
                              {isPositive ? `+${mov.quantity_changed}` : mov.quantity_changed}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-medium text-muted-foreground">{mov.previous_stock ?? 0}</td>
                          <td className="py-4 px-6 text-right font-bold text-foreground">{mov.new_stock ?? 0}</td>
                          <td className="py-4 px-6">
                            <span className="text-sm font-medium text-foreground">{mov.reason || 'Ajuste manual'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-border/30">
                {filteredHistory.map((mov: any) => {
                  const prod = products.find(p => p.id === mov.product_id);
                  const productName = prod ? prod.name : 'Producto Eliminado';
                  const isPositive = mov.quantity_changed > 0;

                  return (
                    <div key={mov.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-sm text-foreground">{productName}</h4>
                          <p className="text-xs text-muted-foreground">{mov.user_name || 'Sistema'}</p>
                        </div>
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black",
                          isPositive 
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        )}>
                          {isPositive ? `+${mov.quantity_changed}` : mov.quantity_changed}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-muted/10 rounded-xl px-3 border border-border/20">
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Ant. Stock</span>
                          <span className="font-semibold text-muted-foreground">{mov.previous_stock ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Nvo. Stock</span>
                          <span className="font-bold text-foreground">{mov.new_stock ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="text-muted-foreground">{new Date(mov.created_at).toLocaleString()}</span>
                        <span className="font-bold text-foreground bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
                          {mov.reason || 'Ajuste manual'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal del formulario */}
      {showForm && quickCreateItemIdx === null && (
          <ProductForm
            product={editingProduct}
            prefilledValues={prefilledFormValues || undefined}
            onClose={handleCloseForm}
            onSuccess={handleProductFormSuccess}
          />
      )}

      <ActiveOffersSheet
        isOpen={showActiveOffers}
        onClose={() => setShowActiveOffers(false)}
      />

      <LimitReachedDialog
        isOpen={showLimitDialog}
        onClose={() => setShowLimitDialog(false)}
        title="Límite de Productos Alcanzado"
        description="Has llegado al máximo de productos permitidos en tu plan actual. Para seguir expandiendo tu inventario, necesitas un plan superior."
        limitType="products"
      />

      {/* Quick Stock Edit Dialog */}
      <Dialog open={!!stockEditProduct} onOpenChange={(open) => !open && setStockEditProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Stock</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Modificando el stock para: <strong className="text-foreground">{stockEditProduct?.name}</strong>
            </p>
            <div className="space-y-2">
              <label htmlFor="quick-stock-input" className="text-sm font-medium">Nuevo Stock</label>
              <Input
                id="quick-stock-input"
                type="number"
                min="0"
                value={stockEditValue}
                onChange={(e) => setStockEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickStockSave();
                  }
                }}
                className="text-lg"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock actual: {stockEditProduct?.stock || 0}
            </p>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStockEditProduct(null)}
              disabled={isUpdatingStock}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleQuickStockSave}
              disabled={isUpdatingStock || stockEditValue === ''}
            >
              {isUpdatingStock ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Actualizar Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={importProgress !== null && importProgress >= 0}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader className="flex flex-col items-center">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Importando productos...
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-3">
            <Progress value={importProgress || 0} className="h-3" />
            <div className="text-center text-sm font-semibold text-muted-foreground">
              {importProgress || 0}% completado
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImportProductsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        headers={importHeaders}
        onConfirm={handleConfirmImport}
      />

      {showPrintLabelsDialog && (
        <PrintLabelsDialog
          isOpen={showPrintLabelsDialog}
          onClose={() => setShowPrintLabelsDialog(false)}
          products={products}
          filteredProductIds={filteredProducts.map(p => p.id)}
        />
      )}
      {/* Diálogo Cargar Stock con IA */}
      <Dialog open={isAIStockOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAIScanning(false);
        }
        setIsAIStockOpen(open);
      }}>
        <DialogContent 
          className="max-w-[95vw] lg:max-w-[1150px] w-auto sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-8 gap-4 sm:gap-6 rounded-2xl"
          centerOnMobile={true}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Cargar Stock con IA
            </DialogTitle>
          </DialogHeader>

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={aiFileInputRef}
            onChange={handleAIStockUpload}
          />

          {extractedItems.length === 0 && !isAIScanning && (
            <div 
              onClick={() => aiFileInputRef.current?.click()}
              className="flex flex-col items-center justify-center py-8 px-4 sm:py-12 sm:px-6 border-2 border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 rounded-2xl cursor-pointer text-center group transition-all duration-200"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-foreground">Subir Foto de Factura</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 max-w-sm leading-relaxed">
                La IA identificará los productos, cantidades, costos e impuestos (ITBIS) de forma automática para cargarlos a tu stock.
              </p>
            </div>
          )}

          {isAIScanning && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <h3 className="font-bold text-lg">Analizando Factura con IA...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Leyendo productos, cantidades, costos e impuestos de la imagen. Por favor espera.
              </p>
            </div>
          )}

          {extractedItems.length > 0 && !isAIScanning && (
            <div className="space-y-4">
              {aiTaxMessage && (
                <div className="p-4 bg-card border border-border/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm animate-pulse",
                      aiIsTaxInclusive ? "bg-blue-500/15 text-blue-500" : "bg-amber-500/15 text-amber-600"
                    )}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        aiIsTaxInclusive ? "text-blue-500" : "text-amber-600"
                      )}>
                        {aiIsTaxInclusive ? "Impuestos Incluidos en Factura" : "Impuestos Adicionados a Factura"}
                      </span>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5 leading-relaxed">
                        {aiIsTaxInclusive 
                          ? "Los precios extraídos ya contienen el ITBIS. El costo registrado será el mismo de la factura."
                          : "Los precios extraídos no contienen el ITBIS. Se ha sumado el ITBIS automáticamente al costo."
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
                    {/* Input para el porcentaje personalizado de ITBIS si no viene en factura */}
                    <div className="flex items-center bg-muted/65 px-3 py-1.5 rounded-xl border border-border/40 h-10 gap-2 shadow-sm">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        % Impuesto:
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customTaxRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleCustomTaxRateChange(isNaN(val) ? 0 : val);
                        }}
                        className="w-12 h-6 text-center font-extrabold px-1 rounded-lg bg-background border border-border/40 text-xs shadow-inner focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground"
                      />
                    </div>

                    {/* Selector de modo de impuestos */}
                    <div className="flex items-center bg-muted/65 p-1 rounded-xl border border-border/40 h-10">
                      <button
                        type="button"
                        onClick={() => handleToggleTaxInclusive(true)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 h-full flex items-center justify-center",
                          aiIsTaxInclusive 
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Sí, Incluyen ITBIS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTaxInclusive(false)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 h-full flex items-center justify-center",
                          !aiIsTaxInclusive 
                            ? "bg-amber-600 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        No, Sumar ITBIS
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isConfirmingSummary ? (
                // --- PREVIEW SCREEN ---
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>Revisa la vista previa de los cambios antes de aplicar</span>
                  </div>

                  <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-sm text-left min-w-[700px]">
                        <thead className="bg-muted text-muted-foreground uppercase tracking-widest text-[10px] font-black border-b border-border/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3 text-center">Modo</th>
                            <th className="px-4 py-3 text-center">Stock Actual</th>
                            <th className="px-4 py-3 text-center">Stock Nuevo</th>
                            <th className="px-4 py-3 text-right">Costo Actual</th>
                            <th className="px-4 py-3 text-right">Costo Nuevo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {extractedItems.map((item) => {
                            const p = products.find(prod => prod.id === item.productId);
                            const isBox = (item.buyMode || 'box') === 'box';
                            const addedStock = isBox 
                              ? Number(item.quantity) * Number(item.unitsPerBox || 1)
                              : Number(item.quantity);
                            const currentStock = p ? Number(p.stock || 0) : 0;
                            const newStock = currentStock + addedStock;
                            const currentCost = p ? Number(p.cost || 0) : 0;
                            const newCost = Number(item.cost);

                            return (
                              <tr key={item.id} className="hover:bg-muted/30 font-semibold">
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="text-foreground">{p?.name || 'Nuevo Producto'}</span>
                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{item.tempName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {isBox ? 'Caja' : 'Unidad'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-muted-foreground">
                                  {currentStock} unds.
                                </td>
                                <td className="px-4 py-3 text-center text-emerald-600 font-extrabold">
                                  {newStock} unds. <span className="text-[10px] text-emerald-500 font-black">(+{addedStock})</span>
                                </td>
                                <td className="px-4 py-3 text-right text-muted-foreground">
                                  ${currentCost.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right text-blue-600 font-extrabold">
                                  ${newCost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                // --- REGULAR INPUTS LIST ---
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Items detectados ({extractedItems.length})</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => aiFileInputRef.current?.click()}
                      className="h-8 text-xs font-semibold"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Escanear Otra
                    </Button>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
                    {extractedItems.map((item, idx) => (
                      <div key={item.id} className="p-5 bg-muted/40 border border-border/80 rounded-2xl flex flex-col gap-4 shadow-sm hover:border-border transition-colors duration-200">
                        {/* Header: Temp name in invoice */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-border/40">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground/80 font-bold uppercase tracking-wider">Nombre en Factura</span>
                            <span className="text-base sm:text-lg font-black text-foreground line-clamp-1">{item.tempName}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            {/* Buy Mode Toggle */}
                            <div className="flex items-center gap-1 bg-background/80 border border-border/60 p-0.5 rounded-xl shadow-inner">
                              <button
                                type="button"
                                onClick={() => setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const currentSub = it.subtotal !== undefined ? it.subtotal : (it.quantity * it.cost * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1));
                                  const totalUnits = it.quantity * (it.unitsPerBox || 1);
                                  const newCost = totalUnits > 0 ? currentSub / totalUnits : 0;
                                  return { ...it, buyMode: 'box', subtotal: currentSub, cost: parseFloat(newCost.toFixed(4)) };
                                }))}
                                className={cn(
                                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200",
                                  (item.buyMode || 'box') === 'box'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground/80 hover:text-foreground hover:bg-accent/40"
                                )}
                              >
                                Caja
                              </button>
                              <button
                                type="button"
                                onClick={() => setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const currentSub = it.subtotal !== undefined ? it.subtotal : (it.quantity * it.cost * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1));
                                  const totalUnits = it.quantity;
                                  const newCost = totalUnits > 0 ? currentSub / totalUnits : 0;
                                  return { ...it, buyMode: 'unit', subtotal: currentSub, cost: parseFloat(newCost.toFixed(4)) };
                                }))}
                                className={cn(
                                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200",
                                  item.buyMode === 'unit'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground/80 hover:text-foreground hover:bg-accent/40"
                                )}
                              >
                                Unidad
                              </button>
                            </div>

                            {/* Quick product creation trigger button */}
                            {item.productId === 'new-product' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  const shouldAutofill = window.confirm(`¿Quieres rellenar la información del nuevo producto con los datos de la factura?\n\nNombre: "${item.tempName}"\nCosto: $${item.cost.toFixed(2)}`);
                                  let prefill: Partial<Product> = {};
                                  if (shouldAutofill) {
                                    prefill = {
                                      name: item.tempName,
                                      cost: item.cost,
                                      tax_percentage: item.taxPercentage,
                                      price: parseFloat((item.cost * 1.30).toFixed(2))
                                    };
                                  }
                                  if (comboboxSearchTerm && /^\d+$/.test(comboboxSearchTerm.trim())) {
                                    prefill.barcode = comboboxSearchTerm.trim();
                                  }
                                  setPrefilledFormValues(prefill);
                                  setQuickCreateItemIdx(idx);
                                  setEditingProduct(null);
                                  setShowForm(true);
                                }}
                                className="h-8 px-3 rounded-lg text-xs font-black uppercase tracking-widest gap-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                              >
                                <PlusCircle className="h-4 w-4" />
                                Crear como Nuevo
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5 items-end">
                          {/* Product Selector */}
                          <div className="flex flex-col gap-1.5 col-span-2 md:col-span-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Asignar a Producto</label>
                            <Popover modal={true} open={openComboIdx === idx} onOpenChange={(open) => {
                              setOpenComboIdx(open ? idx : null);
                              if (!open) setComboboxSearchTerm(''); // Reset search term when closed
                            }}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openComboIdx === idx}
                                  className="w-full h-11 text-sm justify-between px-4 font-semibold border-border/50 bg-background hover:bg-accent/30 rounded-xl"
                                >
                                  <span className="truncate text-left">
                                    {item.productId === 'new-product' 
                                      ? '➕ Nuevo Producto (Crear...)' 
                                      : products.find(p => p.id === item.productId) 
                                        ? `${products.find(p => p.id === item.productId)?.name} (Stock: ${products.find(p => p.id === item.productId)?.stock || 0})`
                                        : 'Seleccionar producto...'
                                    }
                                  </span>
                                  <ChevronDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border rounded-xl shadow-lg" align="start">
                                <Command filter={(value, search) => {
                                  const cleanSearch = search.trim().toLowerCase();
                                  if (!cleanSearch) return 1;
                                  const cleanValue = value.toLowerCase();
                                  
                                  // Substring match avoids fuzzy fragments showing wrong products
                                  return cleanValue.includes(cleanSearch) ? 1 : 0;
                                }}>
                                  <CommandInput 
                                    placeholder="Buscar por nombre, código de barras..." 
                                    className="h-9 text-xs"
                                    value={comboboxSearchTerm}
                                    onValueChange={setComboboxSearchTerm}
                                  />
                                  <CommandList className="max-h-[240px]">
                                    <CommandEmpty className="p-3 text-xs text-muted-foreground font-semibold text-center leading-relaxed">
                                      Este código o término no está asociado a ningún producto. Búscalo por otro campo o crea uno nuevo.
                                    </CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem
                                        value="new-product ➕ nuevo producto crear"
                                        onSelect={() => {
                                          setExtractedItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: 'new-product' } : it));
                                          setOpenComboIdx(null);

                                          // Prompt for auto-fill and open main product form
                                          const shouldAutofill = window.confirm(`¿Quieres rellenar la información del nuevo producto con los datos de la factura?\n\nNombre: "${item.tempName}"\nCosto: $${item.cost.toFixed(2)}`);
                                          let prefill: Partial<Product> = {};
                                          if (shouldAutofill) {
                                            prefill = {
                                              name: item.tempName,
                                              cost: item.cost,
                                              tax_percentage: item.taxPercentage,
                                              price: parseFloat((item.cost * 1.30).toFixed(2))
                                            };
                                          }
                                          if (comboboxSearchTerm && /^\d+$/.test(comboboxSearchTerm.trim())) {
                                            prefill.barcode = comboboxSearchTerm.trim();
                                          }
                                          setPrefilledFormValues(prefill);
                                          setQuickCreateItemIdx(idx);
                                          setEditingProduct(null);
                                          setShowForm(true);
                                        }}
                                        className="p-2 cursor-pointer rounded-lg mx-1 my-0.5 text-xs font-bold text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10 flex items-center"
                                      >
                                        <Check className={cn("mr-2 h-3.5 w-3.5 text-emerald-600", item.productId === 'new-product' ? "opacity-100" : "opacity-0")} />
                                        <span>➕ Nuevo Producto (Crear...)</span>
                                      </CommandItem>
                                      {products.map((p) => {
                                        const barcodeSearchString = p.barcode ? ` ${p.barcode}` : '';
                                        const intCodeSearchString = p.internal_code ? ` ${p.internal_code}` : '';
                                        const extraBarcodesSearchString = p.barcodes?.map(b => ` ${b.barcode}`).join('') || '';
                                        const searchString = `${p.name}${barcodeSearchString}${intCodeSearchString}${extraBarcodesSearchString} ${p.id}`.toLowerCase();

                                        return (
                                          <CommandItem
                                            key={p.id}
                                            value={searchString}
                                            onSelect={() => {
                                              setExtractedItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: p.id } : it));
                                              setOpenComboIdx(null);
                                            }}
                                            className="p-2.5 cursor-pointer rounded-lg mx-1 my-0.5 text-xs flex flex-col items-start gap-1"
                                          >
                                            <div className="flex items-center w-full">
                                              <Check className={cn("mr-2 h-3.5 w-3.5 text-primary shrink-0", item.productId === p.id ? "opacity-100" : "opacity-0")} />
                                              <span className="font-semibold text-foreground truncate flex-1 text-left">{p.name}</span>
                                              <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">Stock: {p.stock || 0}</span>
                                            </div>
                                            {(p.barcode || p.internal_code || (p.barcodes && p.barcodes.length > 0)) && (
                                              <div className="pl-5 flex flex-wrap gap-1 items-center">
                                                {p.internal_code && (
                                                  <span className="text-[8px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono font-bold">Ref: {p.internal_code}</span>
                                                )}
                                                {p.barcode && (
                                                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold">EAN: {p.barcode}</span>
                                                )}
                                                {p.barcodes?.map((extra, eIdx) => (
                                                  <span key={extra.id || eIdx} className="text-[8px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-mono font-bold">Extra: {extra.barcode}</span>
                                                ))}
                                              </div>
                                            )}
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Subtotal Input (Editable) */}
                          <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-extrabold font-black">
                              Subtotal ($)
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.subtotal !== undefined ? item.subtotal : parseFloat((item.quantity * item.cost * (item.buyMode === 'box' ? (item.unitsPerBox || 1) : 1)).toFixed(2)) || ""}
                              onChange={(e) => {
                                const newSubtotal = parseFloat(e.target.value) || 0;
                                setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const totalUnits = it.quantity * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1);
                                  const taxPercentage = it.taxPercentage !== undefined ? it.taxPercentage : customTaxRate;
                                  const baseCost = totalUnits > 0 ? newSubtotal / totalUnits : 0;
                                  const finalCost = aiIsTaxInclusive ? baseCost : (baseCost * (1 + taxPercentage / 100));
                                  return { 
                                    ...it, 
                                    subtotal: newSubtotal, 
                                    cost: parseFloat(finalCost.toFixed(4)) 
                                  };
                                }));
                              }}
                              className="h-11 text-sm font-extrabold px-3 rounded-xl"
                            />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block ml-1 leading-none h-4">
                              Subtotal Ítem
                            </span>
                          </div>

                          {/* Quantity Input */}
                          <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-extrabold font-black">
                              {item.buyMode === 'unit' ? 'Cantidad (Unds.)' : 'Cantidad (Cajas/Paqs)'}
                            </label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseFloat(e.target.value) || 0;
                                setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const totalUnits = newQty * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1);
                                  const currentSub = it.subtotal !== undefined ? it.subtotal : (it.quantity * it.cost * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1));
                                  const taxPercentage = it.taxPercentage !== undefined ? it.taxPercentage : customTaxRate;
                                  const baseCost = totalUnits > 0 ? currentSub / totalUnits : 0;
                                  const finalCost = aiIsTaxInclusive ? baseCost : (baseCost * (1 + taxPercentage / 100));
                                  return { 
                                    ...it, 
                                    quantity: newQty, 
                                    cost: parseFloat(finalCost.toFixed(4)),
                                    subtotal: currentSub
                                  };
                                }));
                              }}
                              className="h-11 text-sm font-extrabold px-3 rounded-xl"
                            />
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block ml-1">
                              Total: {parseFloat((item.buyMode === 'unit' ? item.quantity : (item.quantity * (item.unitsPerBox || 1))).toFixed(2))} unds.
                            </span>
                          </div>

                          {/* Units Per Box Input */}
                          <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-extrabold font-black">Und. x Caja</label>
                            <Input
                              type="number"
                              value={item.unitsPerBox || 1}
                              onChange={(e) => {
                                const newUnits = parseFloat(e.target.value) || 1;
                                setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const totalUnits = it.quantity * (it.buyMode === 'box' ? newUnits : 1);
                                  const currentSub = it.subtotal !== undefined ? it.subtotal : (it.quantity * it.cost * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1));
                                  const taxPercentage = it.taxPercentage !== undefined ? it.taxPercentage : customTaxRate;
                                  const baseCost = totalUnits > 0 ? currentSub / totalUnits : 0;
                                  const finalCost = aiIsTaxInclusive ? baseCost : (baseCost * (1 + taxPercentage / 100));
                                  return { 
                                    ...it, 
                                    unitsPerBox: newUnits, 
                                    cost: parseFloat(finalCost.toFixed(4)),
                                    subtotal: currentSub
                                  };
                                }));
                              }}
                              className="h-11 text-sm font-extrabold px-3 rounded-xl"
                              disabled={item.buyMode === 'unit'}
                            />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block ml-1 text-muted-foreground/70">
                              {item.buyMode === 'unit' ? 'Inactivo (Modo Unidad)' : 'Empaque'}
                            </span>
                          </div>

                          {/* Cost Input (Costo Unitario) */}
                          <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-extrabold font-black">
                              Costo Unitario ($)
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.cost}
                              onChange={(e) => {
                                const newCost = parseFloat(e.target.value) || 0;
                                setExtractedItems(prev => prev.map((it, i) => {
                                  if (i !== idx) return it;
                                  const totalUnits = it.quantity * (it.buyMode === 'box' ? (it.unitsPerBox || 1) : 1);
                                  const taxPercentage = it.taxPercentage !== undefined ? it.taxPercentage : customTaxRate;
                                  const baseSubtotal = totalUnits * newCost;
                                  const finalSubtotal = aiIsTaxInclusive ? baseSubtotal : (baseSubtotal / (1 + taxPercentage / 100));
                                  return { 
                                    ...it, 
                                    cost: newCost, 
                                    subtotal: parseFloat(finalSubtotal.toFixed(2)) 
                                  };
                                }));
                              }}
                              className="h-11 text-sm font-extrabold px-3 rounded-xl"
                            />
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block ml-1 leading-none h-4">
                              {item.buyMode === 'box' ? `Caja: $${(item.cost * (item.unitsPerBox || 1)).toFixed(2)}` : 'Por Unidad'}
                            </span>
                          </div>
                        </div>

                        {item.productId && item.productId !== 'new-product' && products.find(p => p.id === item.productId) && (
                          (() => {
                            const selProd = products.find(p => p.id === item.productId)!;
                            const editVal = editingProductMap[item.id];
                            if (!editVal) return null;
                            return (
                              <div className={cn("mt-2 p-4 bg-background border border-border rounded-xl shadow-inner transition-all", !minimizedProductMap[item.id] ? "space-y-4" : "pb-2")}>
                                <div className="flex items-center justify-between border-b pb-2">
                                  <div className="flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-primary" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                                      Modificar datos en inventario: <span className="text-primary normal-case font-bold">{selProd.name}</span>
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono font-bold text-muted-foreground">
                                      ID: {selProd.id.slice(0, 8)}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => toggleProductMinimize(item.id)}
                                      className="h-6 w-6 rounded-md hover:bg-muted p-0 shrink-0"
                                      title={minimizedProductMap[item.id] ? "Maximizar panel" : "Minimizar panel"}
                                    >
                                      {minimizedProductMap[item.id] ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {!minimizedProductMap[item.id] && (
                                  <>
                                    <div className="grid grid-cols-2 md:grid-cols-7 gap-2.5 items-end">
                                      {/* Nombre */}
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nombre del Producto</label>
                                        <Input
                                          value={editVal.name}
                                          onChange={(e) => updateProductMapField(item.id, 'name', e.target.value)}
                                          className="h-9 text-xs font-semibold"
                                        />
                                      </div>

                                      {/* Código de barras */}
                                      <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                          <Barcode className="h-3 w-3" /> Código Barras
                                        </label>
                                        <Input
                                          value={editVal.barcode}
                                          onChange={(e) => updateProductMapField(item.id, 'barcode', e.target.value)}
                                          className="h-9 text-xs font-mono"
                                        />
                                      </div>

                                      {/* Stock actual */}
                                      <div className="flex flex-col gap-1 col-span-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stock Actual</label>
                                        <Input
                                          type="number"
                                          value={editVal.stock}
                                          onChange={(e) => updateProductMapField(item.id, 'stock', parseFloat(e.target.value) || 0)}
                                          className="h-9 text-xs font-semibold"
                                        />
                                      </div>

                                      {/* Costo */}
                                      <div className="flex flex-col gap-1 col-span-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                                          <DollarSign className="h-3 w-3 text-blue-600" /> Costo ($)
                                        </label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editVal.cost}
                                          onChange={(e) => {
                                            const newCost = parseFloat(e.target.value) || 0;
                                            updateProductMapField(item.id, 'cost', newCost);
                                          }}
                                          className="h-9 text-xs font-semibold"
                                        />
                                      </div>

                                      {/* % Margen */}
                                      <div className="flex flex-col gap-1 col-span-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">% Margen</label>
                                        <Input
                                          type="number"
                                          value={editVal.cost > 0 ? Math.round(((editVal.price - editVal.cost) / editVal.cost) * 100) : 0}
                                          onChange={(e) => {
                                            const pct = parseFloat(e.target.value) || 0;
                                            const newPrice = editVal.cost * (1 + pct / 100);
                                            updateProductMapField(item.id, 'price', parseFloat(newPrice.toFixed(2)));
                                          }}
                                          className="h-9 text-xs font-semibold"
                                          placeholder="%"
                                        />
                                      </div>

                                      {/* Precio Venta */}
                                      <div className="flex flex-col gap-1 col-span-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                                          <DollarSign className="h-3 w-3 text-emerald-600" /> Precio Venta ($)
                                        </label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editVal.price}
                                          onChange={(e) => updateProductMapField(item.id, 'price', parseFloat(e.target.value) || 0)}
                                          className="h-9 text-xs font-semibold"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          // Reset to original values
                                          setEditingProductMap(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              productId: item.productId,
                                              name: selProd.name,
                                              stock: selProd.stock || 0,
                                              price: selProd.price || 0,
                                              cost: selProd.cost || 0,
                                              barcode: selProd.barcode || ''
                                            }
                                          }));
                                        }}
                                        className="h-8 px-3 text-xs font-semibold"
                                      >
                                        Restaurar
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleSaveProductEdit(item.id, item.productId)}
                                        className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                        Guardar Cambios
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex !flex-row justify-end items-center gap-2 sm:gap-3 border-t pt-4 mt-2">
            {isConfirmingSummary ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmingSummary(false)}
                  disabled={isSavingAIStock}
                  className="text-xs h-10 px-4 rounded-xl border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                >
                  Atrás
                </Button>

                <Button
                  type="button"
                  onClick={handleConfirmAIStock}
                  disabled={isSavingAIStock}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 text-xs rounded-xl shadow-lg transition-all"
                >
                  {isSavingAIStock ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Sí, Aplicar<span className="hidden sm:inline"> y Cargar Stock</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAIStockOpen(false);
                    setExtractedItems([]);
                    setIsConfirmingSummary(false);
                  }}
                  disabled={isSavingAIStock}
                  className="text-xs h-10 px-4 rounded-xl border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                >
                  Cancelar
                </Button>

                {extractedItems.length > 0 && (
                  <Button
                    type="button"
                    onClick={() => {
                      const hasUnmapped = extractedItems.some(i => i.productId === 'new-product' || !i.productId);
                      if (hasUnmapped) {
                        toast({
                          title: "Productos no asignados",
                          description: "Asigna todos los productos o regístralos como 'Nuevos' antes de continuar.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setIsConfirmingSummary(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-5 text-xs rounded-xl shadow-lg transition-all"
                  >
                    Confirmar<span className="hidden sm:inline"> y Cargar Stock</span>
                  </Button>
                )}
              </>
            )}
          </DialogFooter>

          {showForm && quickCreateItemIdx !== null && (
            <ProductForm
              product={editingProduct}
              prefilledValues={prefilledFormValues || undefined}
              onClose={handleCloseForm}
              onSuccess={handleProductFormSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Creación Rápida de Producto desde IA */}
      <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
        <DialogContent className="sm:max-w-[420px] p-4 sm:p-6 gap-4">
          <DialogHeader>
            <DialogTitle className="text-md font-bold flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-emerald-500" />
              Crear Nuevo Producto Rápido
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nombre del Producto</label>
              <Input
                value={quickCreateName}
                onChange={(e) => setQuickCreateName(e.target.value)}
                placeholder="Nombre oficial..."
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Costo ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickCreateCost}
                  onChange={(e) => {
                    const costVal = parseFloat(e.target.value) || 0;
                    setQuickCreateCost(costVal);
                    setQuickCreatePrice(parseFloat((costVal * 1.30).toFixed(2)));
                  }}
                  className="h-9 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Precio Venta ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickCreatePrice}
                  onChange={(e) => setQuickCreatePrice(parseFloat(e.target.value) || 0)}
                  className="h-9 font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Impuesto (%)</label>
              <Input
                type="number"
                step="0.01"
                value={quickCreateTax}
                onChange={(e) => setQuickCreateTax(parseFloat(e.target.value) || 0)}
                className="h-9 font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Código de Barras</label>
              <Input
                value={quickCreateBarcode}
                onChange={(e) => setQuickCreateBarcode(e.target.value)}
                placeholder="Código de barras..."
                className="h-9 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQuickCreateOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleQuickCreateProduct}
              disabled={!quickCreateName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs"
            >
              Registrar Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Products;
