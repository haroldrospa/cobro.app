import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Printer, Loader2, Settings, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import JsBarcode from 'jsbarcode';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '@/hooks/useDebounce';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface PrintItem {
  product: Product;
  selected: boolean;
  quantity: number;
}

// Caché para optimizar la carga de SVGs en listas grandes
const barcodeSvgCache = new Map<string, string>();
const getCachedBarcodeSvg = (
  value: string | undefined | null,
  showText: boolean,
  fontSize: number = 14,
  barHeight: number = 60,
  barWidth: number = 1.8
) => {
  if (!value || !value.trim()) return '';
  const cacheKey = `${value}-${showText}-${fontSize}-${barHeight}-${barWidth}`;
  if (barcodeSvgCache.has(cacheKey)) return barcodeSvgCache.get(cacheKey)!;

  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, value, {
      format: "CODE128",
      displayValue: showText,
      fontSize: fontSize,
      margin: 0,
      height: barHeight, // Height in px for the barcode lines (SVG internal scale)
      width: barWidth // Bar width
    });
    const serializer = new XMLSerializer();
    const result = serializer.serializeToString(svg);
    barcodeSvgCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.warn("Error generating barcode for", value);
    return '';
  }
};

interface PrintLabelsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  filteredProductIds?: string[];
}

export function PrintLabelsDialog({ isOpen, onClose, products, filteredProductIds }: PrintLabelsDialogProps) {
  const { settings } = useCompanySettings();
  const { data: userStore } = useUserStore();
  const { settings: storeSettings, updateSettings } = useStoreSettings();
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const { toast } = useToast();

  const savedSettings = useMemo(() => {
    try {
      const saved = localStorage.getItem('cobro_label_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading label settings", e);
    }
    return {};
  }, []);

  // Plantillas personalizadas sincronizadas en Base de Datos con Fallback a localStorage
  const customTemplates = useMemo(() => {
    const dbTemplates = storeSettings?.label_templates;
    if (Array.isArray(dbTemplates) && dbTemplates.length > 0) {
      return dbTemplates;
    }
    try {
      const saved = localStorage.getItem('cobro_label_custom_templates');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading custom templates from localStorage", e);
    }
    return [];
  }, [storeSettings?.label_templates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => savedSettings.selectedTemplateId ?? '');
  const [isConfigExpanded, setIsConfigExpanded] = useState<boolean>(() => !savedSettings.selectedTemplateId);

  // Configuraciones de etiqueta
  const [labelWidth, setLabelWidth] = useState<number>(savedSettings.labelWidth ?? 50); // mm
  const [labelHeight, setLabelHeight] = useState<number>(savedSettings.labelHeight ?? 30); // mm
  const [columns, setColumns] = useState<number>(savedSettings.columns ?? 1);
  const [gapX, setGapX] = useState<number>(savedSettings.gapX ?? 2); // mm
  const [gapY, setGapY] = useState<number>(savedSettings.gapY ?? 2); // mm

  // Opciones de visualización
  const [showBusinessName, setShowBusinessName] = useState<boolean>(savedSettings.showBusinessName ?? true);
  const [showProductName, setShowProductName] = useState<boolean>(savedSettings.showProductName ?? true);
  const [showPrice, setShowPrice] = useState<boolean>(savedSettings.showPrice ?? true);
  const [showBarcodeText, setShowBarcodeText] = useState<boolean>(savedSettings.showBarcodeText ?? true);
  const [rotation, setRotation] = useState<number>(savedSettings.rotation ?? 0);

  // Tamaños de fuente
  const [bnameSize, setBnameSize] = useState<number>(savedSettings.bnameSize ?? 10);
  const [pnameSize, setPnameSize] = useState<number>(savedSettings.pnameSize ?? 11);
  const [priceSize, setPriceSize] = useState<number>(savedSettings.priceSize ?? 16);
  const [barcodeFontSize, setBarcodeFontSize] = useState<number>(savedSettings.barcodeFontSize ?? 14);

  // Altura y grosor manual del código de barras
  const [barHeight, setBarHeight] = useState<number>(savedSettings.barHeight ?? 45); // Altura en px (JsBarcode)
  const [barWidth, setBarWidth] = useState<number>(savedSettings.barWidth ?? 1.8);  // Grosor en px (JsBarcode)

  // Persistir settings con debounce — evita escribir localStorage en cada keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cobro_label_settings', JSON.stringify({
        labelWidth, labelHeight, columns, gapX, gapY,
        showBusinessName, showProductName, showPrice, showBarcodeText, rotation,
        bnameSize, pnameSize, priceSize, barcodeFontSize,
        barHeight, barWidth, selectedTemplateId
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [labelWidth, labelHeight, columns, gapX, gapY, showBusinessName, showProductName, showPrice, showBarcodeText, rotation, bnameSize, pnameSize, priceSize, barcodeFontSize, barHeight, barWidth, selectedTemplateId]);

  // Lista interactiva de impresión
  const [printList, setPrintList] = useState<PrintItem[]>(() =>
    products.map(p => ({ product: p, selected: false, quantity: 1 }))
  );
  const [previewId, setPreviewId] = useState<string>(printList[0]?.product.id || '');

  // Paginación progresiva para evitar la lentitud al renderizar miles de productos
  const [visibleCount, setVisibleCount] = useState(80);

  // Estado para controlar si mostramos solo los productos filtrados por la tabla del padre
  const [showFilteredOnly, setShowFilteredOnly] = useState<boolean>(
    () => !!filteredProductIds && filteredProductIds.length < products.length
  );

  useEffect(() => {
    setVisibleCount(80);
  }, [debouncedSearch, showFilteredOnly]);

  // Calcular dinámicamente la altura máxima del código de barra según la cantidad de textos habilitados
  const barcodeMaxHeightMultiplier = useMemo(() => {
    let activeTextElements = 0;
    if (showBusinessName) activeTextElements++;
    if (showProductName) activeTextElements++;
    if (showPrice) activeTextElements++;

    if (activeTextElements === 3) return 0.28;
    if (activeTextElements === 2) return 0.38;
    if (activeTextElements === 1) return 0.48;
    return 0.6;
  }, [showBusinessName, showProductName, showPrice]);

  // Perfiles predeterminados para facilitar la vida al usuario
  const applyProfile = useCallback((profileId: string) => {
    setSelectedTemplateId(profileId);
    setIsConfigExpanded(false);

    if (profileId === 'thermal') {
      setLabelWidth(50);
      setLabelHeight(30);
      setColumns(1);
      setGapX(0);
      setGapY(4);
      setRotation(180);
      setShowBusinessName(true);
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(10);
      setPnameSize(11);
      setPriceSize(16);
      setBarcodeFontSize(12);
      setBarHeight(40);
      setBarWidth(1.6);
    } else if (profileId === 'thermal_small') {
      setLabelWidth(30);
      setLabelHeight(20);
      setColumns(1);
      setGapX(0);
      setGapY(2);
      setRotation(180);
      setShowBusinessName(false);
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(8);
      setPnameSize(9);
      setPriceSize(11);
      setBarcodeFontSize(9);
      setBarHeight(25);
      setBarWidth(1.2);
    } else if (profileId === 'a4_3x10') {
      setLabelWidth(66);
      setLabelHeight(25);
      setColumns(3);
      setGapX(2);
      setGapY(2);
      setRotation(0);
      setShowBusinessName(true);
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(10);
      setPnameSize(11);
      setPriceSize(16);
      setBarcodeFontSize(12);
      setBarHeight(40);
      setBarWidth(1.6);
    } else {
      // Buscar plantilla personalizada
      const template = customTemplates.find(t => t.id === profileId);
      if (template) {
        setLabelWidth(template.labelWidth);
        setLabelHeight(template.labelHeight);
        setColumns(template.columns);
        setGapX(template.gapX);
        setGapY(template.gapY);
        setRotation(template.rotation);
        setShowBusinessName(template.showBusinessName);
        setShowProductName(template.showProductName);
        setShowPrice(template.showPrice);
        setShowBarcodeText(template.showBarcodeText);
        setBnameSize(template.bnameSize);
        setPnameSize(template.pnameSize);
        setPriceSize(template.priceSize);
        setBarcodeFontSize(template.barcodeFontSize);
        setBarHeight(template.barHeight);
        setBarWidth(template.barWidth);
      }
    }
  }, [customTemplates]);

  const handleSaveTemplate = async () => {
    const name = prompt("Introduce el nombre de la planilla de configuración (ej: Rollo 30x20):");
    if (!name || !name.trim()) return;

    const newTemplate = {
      id: `template_${Date.now()}`,
      name: name.trim(),
      labelWidth,
      labelHeight,
      columns,
      gapX,
      gapY,
      showBusinessName,
      showProductName,
      showPrice,
      showBarcodeText,
      rotation,
      bnameSize,
      pnameSize,
      priceSize,
      barcodeFontSize,
      barHeight,
      barWidth
    };

    const updated = [...customTemplates, newTemplate];
    try {
      await updateSettings({ label_templates: updated });
    } catch (e) {
      console.error("Error saving template to DB:", e);
    }
    localStorage.setItem('cobro_label_custom_templates', JSON.stringify(updated));
    setSelectedTemplateId(newTemplate.id);
    toast({
      title: "Planilla guardada",
      description: `Se ha creado la planilla de configuración "${name}" con éxito.`
    });
  };

  const handleDeleteTemplate = async () => {
    const template = customTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    if (confirm(`¿Estás seguro de eliminar la planilla de configuración "${template.name}"?`)) {
      const updated = customTemplates.filter(t => t.id !== selectedTemplateId);
      try {
        await updateSettings({ label_templates: updated });
      } catch (e) {
        console.error("Error deleting template from DB:", e);
      }
      localStorage.setItem('cobro_label_custom_templates', JSON.stringify(updated));
      setSelectedTemplateId('');
      toast({
        title: "Planilla eliminada",
        description: `Se ha eliminado la planilla de configuración "${template.name}".`
      });
    }
  };



  const handlePrint = async () => {
    setIsPrinting(true);

    // Abrimos la ventana sincrónicamente con el click para evitar popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("El navegador bloqueó la ventana emergente. Por favor permite popups para imprimir.");
      setIsPrinting(false);
      return;
    }

    // Retrasar el render complejo para que la UI se actualice
    setTimeout(() => {
      try {
        const selectedItems = printList.filter(item => item.selected && item.quantity > 0);

        if (selectedItems.length === 0) {
          printWindow.close();
          alert("No has seleccionado ningún producto o las cantidades son 0.");
          setIsPrinting(false);
          return;
        }

        const isSwapped = rotation === 90 || rotation === 270;
        const printW = isSwapped ? labelHeight : labelWidth;
        const printH = isSwapped ? labelWidth : labelHeight;

        const labelsHtml = selectedItems.flatMap(item => {
          const barcodeSvg = getCachedBarcodeSvg(item.product.barcode, showBarcodeText, barcodeFontSize, barHeight, barWidth);

          const labelHtml = `
            <div class="label">
              <div class="label-content">
                ${showBusinessName ? `<div class="business-name" style="font-size: ${bnameSize}px">${settings?.company_name || userStore?.store_name || 'Mi Negocio'}</div>` : ''}
                ${showProductName ? `<div class="product-name" style="font-size: ${pnameSize}px">${item.product.name}</div>` : ''}
                ${showPrice ? `<div class="product-price" style="font-size: ${priceSize}px">$${(item.product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
                <div class="barcode-container">
                  ${barcodeSvg}
                </div>
              </div>
            </div>
          `;
          return Array(item.quantity).fill(labelHtml);
        }).join('');

        const printContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Imprimir Etiquetas</title>
            <style>
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f1f5f9;
                display: flex;
                justify-content: center;
              }

              .labels-container {
                display: grid;
                grid-template-columns: repeat(${columns}, ${printW}mm);
                column-gap: ${gapX}mm;
                row-gap: ${gapY}mm;
                ${columns > 1 ? 'justify-content: center; padding-top: 10mm;' : ''}
                width: max-content;
                max-width: 100%;
              }

              .label {
                width: ${printW}mm;
                height: ${printH - 2}mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                background: white;
                box-sizing: border-box;
                padding: 0;
                margin: 0 auto;
                border: 1px dotted #ccc; 
              }

              .label-content {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
                padding: 1.5mm;
                box-sizing: border-box;
                overflow: hidden;
                ${rotation !== 0 ? `transform: rotate(${rotation}deg);` : ''}
              }

              .label-content * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              .business-name {
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                text-align: center;
              }

              .product-name {
                font-size: 11px;
                line-height: 1.2;
                margin-bottom: 2px;
                max-height: 26px;
                overflow: hidden;
                width: 100%;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                text-align: center;
              }

              .product-price {
                font-size: 16px;
                font-weight: 800;
                margin-bottom: 2px;
                text-align: center;
              }

              .barcode-container {
                display: flex;
                justify-content: center;
                align-items: center;
                flex-shrink: 0;
                width: 100%;
                overflow: hidden;
              }

              .barcode-container svg {
                max-width: 100%;
                max-height: ${labelHeight * barcodeMaxHeightMultiplier}mm; 
                width: auto;
                height: auto;
                display: block;
              }

              /* Page rules for thermal continuous vs defined A4 */
              @page {
                size: ${columns === 1 ? (printW + 'mm ' + printH + 'mm') : 'A4'};
                margin: 0 !important;
              }

              @media print {
                html, body {
                  width: ${columns === 1 ? printW + 'mm' : '100%'};
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: hidden !important;
                  background-color: #fff;
                }
                
                ${columns === 1 ? `
                  .labels-container {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    width: 100% !important;
                    column-gap: 0 !important;
                    row-gap: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .label {
                    display: flex !important;
                    width: ${printW - 1}mm !important;
                    height: ${printH - 1.5}mm !important;
                    border: none !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                  }
                  .label:not(:last-child) {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                  .label-content {
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: center !important;
                    align-items: center !important;
                    width: 100% !important;
                    height: 100% !important;
                    overflow: hidden !important;
                    padding: 1.5mm !important;
                    box-sizing: border-box !important;
                  }
                  .label-text, .barcode-container {
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    width: 100% !important;
                  }
                  .barcode-container svg {
                    display: block !important;
                  }
                ` : `
                  .label {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    border: none;
                  }
                `}
              }

            </style>
          </head>
          <body>
            <div class="labels-container">
              ${labelsHtml}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 500);
              };
            </script>
          </body>
          </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
      } catch (err) {
        console.error("Error generating print:", err);
        printWindow.close();
        alert("Hubo un error al generar las etiquetas.");
      } finally {
        setIsPrinting(false);
      }
    }, 100);
  };

  // ---- Listas derivadas memoizadas (crítico: products puede ser 1638+ items) ----
  const filteredPrintList = useMemo(() => {
    let list = printList;
    if (showFilteredOnly && filteredProductIds) {
      const filterSet = new Set(filteredProductIds);
      list = list.filter(item => filterSet.has(item.product.id));
    }
    return list.filter(item =>
      item.product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (item.product.barcode?.toLowerCase() || '').includes(debouncedSearch.toLowerCase())
    );
  }, [printList, debouncedSearch, showFilteredOnly, filteredProductIds]);

  const selectedItems = useMemo(
    () => printList.filter(item => item.selected && item.quantity > 0),
    [printList]
  );

  const totalLabelsToPrint = useMemo(
    () => selectedItems.reduce((acc, item) => acc + item.quantity, 0),
    [selectedItems]
  );

  const maxPreviewLabels = 60; // Límite para el DOM
  const previewLabels = useMemo(
    () => selectedItems.flatMap(item => Array(item.quantity).fill(item.product)).slice(0, maxPreviewLabels),
    [selectedItems]
  );

  // CSS compartido para la vista previa de barcodes (1 bloque, no 1 por producto)
  const previewBarcodeStyle = useMemo(() => `
    .preview-barcode-container svg {
      max-width: 100%;
      height: auto;
      max-height: ${labelHeight * barcodeMaxHeightMultiplier}mm;
    }
  `, [labelHeight, barcodeMaxHeightMultiplier]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-6xl lg:max-w-7xl h-[90vh] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Printer className="h-6 w-6 text-primary" />
            Configuración de Etiquetas
          </DialogTitle>
          <DialogDescription>
            Configura el tamaño y contenido de las etiquetas para los {products.length} productos en el filtro actual.
            Puedes desmarcar los que no necesites.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
          <ScrollArea className="flex-1 px-6 pb-6 md:w-[58%] lg:w-[60%]">
            <div className="space-y-6 pt-4">
              {/* Planillas de Configuración de Etiquetas */}
              <div className="space-y-3 bg-secondary/30 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <Label className="flex items-center gap-2 font-semibold">
                    <Settings className="w-4 h-4" /> Planillas de Configuración (Medidas y Diseño)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveTemplate}
                      className="h-7 text-xs px-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      Guardar Planilla Actual
                    </Button>
                    {selectedTemplateId && !['thermal', 'thermal_small', 'a4_3x10'].includes(selectedTemplateId) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteTemplate}
                        className="h-7 text-xs px-2 border-rose-500 text-rose-600 hover:bg-rose-50 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        Eliminar Planilla
                      </Button>
                    )}
                  </div>
                </div>
                <Select value={selectedTemplateId} onValueChange={applyProfile}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar una planilla de diseño..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Impresora Térmica Estandar (50x30mm)</SelectItem>
                    <SelectItem value="thermal_small">Impresora Térmica Pequeña (30x20mm)</SelectItem>
                    <SelectItem value="a4_3x10">Hoja A4 - 3 Columnas (Planilla tipo Avery)</SelectItem>

                    {customTemplates.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Mis Planillas Guardadas (Diseños)
                        </div>
                        {customTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            ✨ {t.name} ({t.labelWidth}x{t.labelHeight}mm)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 rounded-lg border border-transparent hover:border-border/30 hover:bg-background/40"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {isConfigExpanded ? "Ocultar Ajustes de Medidas" : "Personalizar Medidas y Diseño"}
                    {isConfigExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {isConfigExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Dimensiones */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-1">1. Dimensiones (mm)</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ancho (mm)</Label>
                        <Input type="number" value={labelWidth} onChange={(e) => setLabelWidth(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Alto (mm)</Label>
                        <Input type="number" value={labelHeight} onChange={(e) => setLabelHeight(Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Columnas</Label>
                        <Input type="number" min="1" max="10" value={columns} onChange={(e) => setColumns(Number(e.target.value))} />
                      </div>
                      <div className="space-y-2 flex flex-col justify-end pb-1">
                        <Label className="text-xs">Rotación</Label>
                        <Select value={rotation.toString()} onValueChange={(val) => setRotation(Number(val))}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Rotación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Normal (0°)</SelectItem>
                            <SelectItem value="90">Girar 90° (Acostado)</SelectItem>
                            <SelectItem value="180">Girar 180° (Volteado)</SelectItem>
                            <SelectItem value="270">Girar 270°</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {columns > 1 && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Espaciado X (mm)</Label>
                          <Input type="number" value={gapX} onChange={(e) => setGapX(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Espaciado Y (mm)</Label>
                          <Input type="number" value={gapY} onChange={(e) => setGapY(Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contenido Visual */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-1">2. Información a Mostrar</h4>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show_bname" className="cursor-pointer">Nombre del Negocio</Label>
                        <div className="flex items-center gap-2">
                          {showBusinessName && <Input type="number" min="6" max="24" className="w-16 h-8 text-xs" value={bnameSize} onChange={(e) => setBnameSize(Number(e.target.value))} title="Tamaño (px)" />}
                          <Switch id="show_bname" checked={showBusinessName} onCheckedChange={setShowBusinessName} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="show_pname" className="cursor-pointer">Nombre del Producto</Label>
                        <div className="flex items-center gap-2">
                          {showProductName && <Input type="number" min="6" max="24" className="w-16 h-8 text-xs" value={pnameSize} onChange={(e) => setPnameSize(Number(e.target.value))} title="Tamaño (px)" />}
                          <Switch id="show_pname" checked={showProductName} onCheckedChange={setShowProductName} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="show_price" className="cursor-pointer">Precio de Venta</Label>
                        <div className="flex items-center gap-2">
                          {showPrice && <Input type="number" min="8" max="32" className="w-16 h-8 text-xs" value={priceSize} onChange={(e) => setPriceSize(Number(e.target.value))} title="Tamaño (px)" />}
                          <Switch id="show_price" checked={showPrice} onCheckedChange={setShowPrice} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="show_btext" className="cursor-pointer">Número del Código</Label>
                        <div className="flex items-center gap-2">
                          {showBarcodeText && <Input type="number" min="6" max="24" className="w-16 h-8 text-xs" value={barcodeFontSize} onChange={(e) => setBarcodeFontSize(Number(e.target.value))} title="Tamaño (px)" />}
                          <Switch id="show_btext" checked={showBarcodeText} onCheckedChange={setShowBarcodeText} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-3 mt-2">
                        <Label htmlFor="bar_height" className="text-xs font-semibold">Altura del Código (px)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="bar_height"
                            type="number"
                            min="10"
                            max="150"
                            className="w-16 h-8 text-xs"
                            value={barHeight}
                            onChange={(e) => setBarHeight(Number(e.target.value))}
                            title="Altura del código de barras en px"
                          />
                          <div className="w-11 shrink-0" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Label htmlFor="bar_width" className="text-xs font-semibold">Grosor de Líneas</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="bar_width"
                            type="number"
                            min="1.0"
                            max="4.0"
                            step="0.1"
                            className="w-16 h-8 text-xs"
                            value={barWidth}
                            onChange={(e) => setBarWidth(Number(e.target.value))}
                            title="Grosor de las líneas del código (1.0 - 4.0)"
                          />
                          <div className="w-11 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de selección interactiva */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-1">
                  <h4 className="font-semibold text-sm">3. Productos y Cantidad</h4>
                  <div className="flex gap-2 text-xs">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const filteredIds = new Set(filteredPrintList.map(i => i.product.id));
                      setPrintList(prev => prev.map(i => filteredIds.has(i.product.id) ? { ...i, selected: true } : i));
                    }} className="h-6 px-2 text-xs">Marcar Todos</Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const filteredIds = new Set(filteredPrintList.map(i => i.product.id));
                      setPrintList(prev => prev.map(i => filteredIds.has(i.product.id) ? { ...i, selected: false } : i));
                    }} className="h-6 px-2 text-xs">Desmarcar</Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {filteredProductIds && filteredProductIds.length < products.length && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs">
                    <span className="text-muted-foreground">
                      {showFilteredOnly
                        ? `Mostrando solo los ${filteredProductIds.length} productos del filtro de la tabla.`
                        : `Mostrando todos los ${products.length} productos del catálogo.`
                      }
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      onClick={() => setShowFilteredOnly(!showFilteredOnly)}
                      className="h-auto p-0 font-bold text-primary hover:text-primary/80"
                    >
                      {showFilteredOnly ? "Ver todo el catálogo" : "Volver al filtro"}
                    </Button>
                  </div>
                )}

                <div
                  className="max-h-[300px] overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-background"
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
                      if (visibleCount < filteredPrintList.length) {
                        setVisibleCount(prev => Math.min(prev + 80, filteredPrintList.length));
                      }
                    }
                  }}
                >
                  {filteredPrintList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 px-2">No se encontraron productos.</p>
                  ) : (
                    <>
                      {filteredPrintList.slice(0, visibleCount).map((item) => (
                        <div key={item.product.id} className={`flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors border-transparent border`}
                          onClick={() => {
                            setPrintList(prev => prev.map(i => i.product.id === item.product.id ? { ...i, selected: !i.selected } : i));
                          }}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={(c) => {
                                setPrintList(prev => prev.map(i => i.product.id === item.product.id ? { ...i, selected: !!c } : i));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col overflow-hidden min-w-[120px]">
                              <span className="text-sm font-medium truncate" title={item.product.name}>{item.product.name}</span>
                              <span className="text-xs text-muted-foreground truncate">{item.product.barcode} - ${(item.product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Label className="text-xs">Cant:</Label>
                            <Input
                              type="number"
                              min="0"
                              className="w-16 h-8 text-sm"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value) || 0;
                                setPrintList(prev => prev.map(i => {
                                  if (i.product.id === item.product.id) {
                                    return { ...i, quantity: qty, selected: qty > 0 ? true : i.selected };
                                  }
                                  return i;
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      ))}
                      {filteredPrintList.length > visibleCount && (
                        <div className="text-center py-2 text-xs text-muted-foreground border-t border-dashed mt-2">
                          Mostrando {visibleCount} de {filteredPrintList.length} productos. Desliza hacia abajo para cargar más...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-xs">
                <p><strong>Truco Térmico:</strong> Si usas impresora térmica continua (1 columna), asegúrate que el navegador no agregue márgenes ni encaboezados propios (Desactiva "Headers/Footers" y pon "Margins: None" en el diálogo de sistema).</p>
              </div>
            </div>
          </ScrollArea>

          <div className="md:w-[42%] lg:w-[40%] shrink-0 flex flex-col overflow-hidden bg-muted/20 border-l">
            <div className="p-4 border-b flex justify-between items-center bg-white dark:bg-zinc-950 shrink-0">
              <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                Vista Previa Completa
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                  {totalLabelsToPrint} etiquetas
                </span>
              </h4>
              {totalLabelsToPrint > maxPreviewLabels && (
                <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-1 rounded font-medium">
                  Mostrando primeras {maxPreviewLabels}
                </span>
              )}
            </div>

            <ScrollArea className="flex-1 bg-zinc-100 dark:bg-zinc-900">
              {/* Un solo bloque de estilo compartido para todos los barcodes de la vista previa */}
              <style dangerouslySetInnerHTML={{ __html: previewBarcodeStyle }} />
              <div className="p-8 flex items-start justify-center min-w-max min-h-full">
                {previewLabels.length === 0 ? (
                  <div className="h-60 flex flex-col items-center justify-center text-muted-foreground gap-3 p-4 text-center">
                    <Printer className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No hay etiquetas para previsualizar</p>
                      <p className="text-xs text-muted-foreground/80 max-w-[240px]">
                        Selecciona productos en el listado de la izquierda y define una cantidad para ver la vista previa.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="bg-white shadow-xl dark:bg-white" // Force white background for the "paper"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${columns}, ${rotation === 90 || rotation === 270 ? labelHeight : labelWidth}mm)`,
                      columnGap: `${gapX}mm`,
                      rowGap: `${gapY}mm`,
                      width: 'max-content',
                      padding: columns > 1 ? '10mm' : '0' // Give some padding around the sheet if printing A4
                    }}
                  >
                    {previewLabels.map((prod, index) => (
                      <div
                        key={`${prod.id}-${index}`}
                        className="border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative shadow-sm"
                        style={{
                          width: `${rotation === 90 || rotation === 270 ? labelHeight : labelWidth}mm`,
                          height: `${rotation === 90 || rotation === 270 ? labelWidth : labelHeight}mm`,
                          padding: '0',
                          border: columns > 1 ? '1px dotted #ccc' : 'none',
                          borderBottom: columns === 1 ? '1px dashed #ccc' : '1px dotted #ccc',
                        }}
                      >
                        <div className="relative flex flex-col items-center justify-center text-center overflow-hidden text-black" style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm`, padding: '1.5mm', transform: rotation !== 0 ? `rotate(${rotation}deg)` : 'none', transformOrigin: 'center' }}>
                          <div className="flex flex-col items-center justify-center w-full">
                            {showBusinessName && (
                              <div className="font-bold uppercase mb-[2px] w-full text-center" style={{ fontSize: `${bnameSize}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {settings?.company_name || userStore?.store_name || 'Mi Negocio'}
                              </div>
                            )}
                            {showProductName && (
                              <div className="w-full text-center leading-tight mb-[2px]" style={{ fontSize: `${pnameSize}px`, maxHeight: '26px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {prod.name}
                              </div>
                            )}
                            {showPrice && (
                              <div className="font-extrabold mb-[2px] w-full text-center" style={{ fontSize: `${priceSize}px` }}>
                                ${(prod.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                          <div className="w-full flex justify-center items-center flex-shrink-0 preview-barcode-container"
                            dangerouslySetInnerHTML={{ __html: getCachedBarcodeSvg(prod.barcode, showBarcodeText, barcodeFontSize, barHeight, barWidth) }}
                          />

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-secondary/20 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPrinting}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting} className="bg-primary text-white">
            {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            {isPrinting ? "Generando..." : "Imprimir Etiquetas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
