import { useState, useRef, FC, ChangeEvent, useEffect } from 'react';
import { Package, Plus, Search, Edit, Trash2, Upload, Download, Hash, Barcode, Tag, DollarSign, AlertTriangle, Printer, Loader2, ImageIcon, Pencil, ChefHat, FlaskConical, RefreshCw, Asterisk } from 'lucide-react';
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
import { useProductsOffline, useDeleteProductOffline, useUpdateProductOffline } from '@/hooks/useProductsOffline';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useBusinessType } from '@/hooks/useBusinessType';
import { ActiveOffersSheet } from '@/components/products/ActiveOffersSheet';
import { PrintLabelsDialog } from '@/components/products/PrintLabelsDialog';
import { ImportProductsDialog } from '@/components/products/ImportProductsDialog';
import { RestaurantInventoryControl } from '@/components/products/RestaurantInventoryControl';
import ProductForm from './ProductForm';
import { LimitReachedDialog } from './subscription/PlanRestrictions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type ProductsTab = 'products' | 'inventory';

type SearchType = 'all' | 'name' | 'id' | 'barcode' | 'category';

const Products: FC = () => {
  const { isRestaurant } = useBusinessType();
  const [activeTab, setActiveTab] = useState<ProductsTab>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showPrintLabelsDialog, setShowPrintLabelsDialog] = useState(false);

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
  
  const { data: products = [], isLoading } = useProductsOffline();
  const { data: categories = [] } = useCategories();
  const deleteProduct = useDeleteProductOffline();
  const updateProduct = useUpdateProductOffline();
  const deleteAllProducts = useDeleteAllProducts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings: companySettings } = useCompanySettings();
  const { hasReachedLimit, getRemainingCount } = usePlanFeatures();
  const recipeAvailability = useRecipeAvailability();

  // Cálculos detallados del valor del inventario
  const inventoryStats = products.reduce((acc, product) => {
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
  }, { costoSinImpuesto: 0, costoConImpuesto: 0, valorEnPrecio: 0 });
  // Contar productos con stock bajo
  // Un producto está bajo de stock si su stock actual es menor o igual al mínimo
  const lowStockProducts = products.filter(p => {
    // Excluir productos que no controlan inventario
    if (p.track_inventory === false) return false;

    const currentStock = p.stock || 0;
    const minStock = p.min_stock || 0;
    // Solo alertar si el producto controla inventario Y tiene stock bajo
    return currentStock <= minStock;
  });
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
        stock: newStock
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

  const filteredProducts = products.filter(product => {
    // Filtro por stock bajo
    if (showLowStockOnly && !((product.stock || 0) <= (product.min_stock || 0))) {
      return false;
    }

    // Filtro por categoría
    if (selectedCategory !== 'all' && product.category_id !== selectedCategory) {
      return false;
    }

    // Si no hay término de búsqueda, mostrar todos (con filtro de categoría aplicado)
    if (!searchTerm.trim()) {
      return true;
    }

    // Filtro según tipo de búsqueda
    const searchLower = searchTerm.toLowerCase().trim();

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
  });

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [searchTerm, searchType, selectedCategory, showLowStockOnly]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

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

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleFormSuccess = () => {
    // La query se invalidará automáticamente por el hook
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


  if (isLoading) {
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

        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl px-4">
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
              <DropdownMenuItem onSelect={() => setShowPrintLabelsDialog(true)} className="rounded-xl py-2.5 font-bold text-xs uppercase tracking-wider">
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

      {/* Centered Tab Selector - if restaurant */}
      {isRestaurant && (
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-muted/20 border border-border/30 rounded-2xl backdrop-blur-sm">
            <Button
              variant={activeTab === 'products' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('products')}
              className={cn(
                "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest",
                activeTab === 'products' && "bg-background shadow-lg"
              )}
            >
              <Package className="mr-2 h-3.5 w-3.5" />
              Catálogo
            </Button>
            <Button
              variant={activeTab === 'inventory' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest",
                activeTab === 'inventory' && "bg-background shadow-lg"
              )}
            >
              <FlaskConical className="mr-2 h-3.5 w-3.5" />
              Materia Prima
            </Button>
          </div>
        </div>
      )}

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

      {/* Modal del formulario */}
      {showForm && (
          <ProductForm
            product={editingProduct}
            onClose={handleCloseForm}
            onSuccess={handleFormSuccess}
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
          products={filteredProducts}
        />
      )}
    </div >
  );
};

export default Products;
