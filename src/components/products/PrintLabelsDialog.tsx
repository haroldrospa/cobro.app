import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Printer, Loader2, Settings, Search } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useUserStore } from '@/hooks/useUserStore';
import JsBarcode from 'jsbarcode';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '@/hooks/useDebounce';

interface PrintItem {
  product: Product;
  selected: boolean;
  quantity: number;
}

// Caché para optimizar la carga de SVGs en listas grandes
const barcodeSvgCache = new Map<string, string>();
const getCachedBarcodeSvg = (value: string | undefined | null, showText: boolean, fontSize: number = 14) => {
  if (!value || !value.trim()) return '';
  const cacheKey = `${value}-${showText}-${fontSize}`;
  if (barcodeSvgCache.has(cacheKey)) return barcodeSvgCache.get(cacheKey)!;
  
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, value, {
      format: "CODE128",
      displayValue: showText,
      fontSize: fontSize,
      margin: 0,
      height: 60, // Height in px for the barcode lines (SVG internal scale)
      width: 1.8 // Bar width
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
}

export function PrintLabelsDialog({ isOpen, onClose, products }: PrintLabelsDialogProps) {
  const { settings } = useCompanySettings();
  const { data: userStore } = useUserStore();
  const [isPrinting, setIsPrinting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);

  const savedSettings = useMemo(() => {
    try {
      const saved = localStorage.getItem('cobro_label_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading label settings", e);
    }
    return {};
  }, []);

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

  // Persistir settings con debounce — evita escribir localStorage en cada keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cobro_label_settings', JSON.stringify({
        labelWidth, labelHeight, columns, gapX, gapY,
        showBusinessName, showProductName, showPrice, showBarcodeText, rotation,
        bnameSize, pnameSize, priceSize, barcodeFontSize
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [labelWidth, labelHeight, columns, gapX, gapY, showBusinessName, showProductName, showPrice, showBarcodeText, rotation, bnameSize, pnameSize, priceSize, barcodeFontSize]);

  // Lista interactiva de impresión
  const [printList, setPrintList] = useState<PrintItem[]>(() => 
    products.map(p => ({ product: p, selected: false, quantity: 1 }))
  );
  const [previewId, setPreviewId] = useState<string>(printList[0]?.product.id || '');

  // Perfiles predeterminados para facilitar la vida al usuario
  const applyProfile = useCallback((profile: string) => {
    if (profile === 'thermal') {
      setLabelWidth(50);
      setLabelHeight(30);
      setColumns(1);
      setGapX(0);
      setGapY(4);
      setRotation(180);
    } else if (profile === 'thermal_small') {
      setLabelWidth(30);
      setLabelHeight(20);
      setColumns(1);
      setGapX(0);
      setGapY(2);
      setShowBusinessName(false);
      setRotation(180);
    } else if (profile === 'a4_3x10') { // Estilo Avery
      setLabelWidth(66);
      setLabelHeight(25);
      setColumns(3);
      setGapX(2);
      setGapY(2);
      setRotation(0);
    }
  }, []);

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
          const barcodeSvg = getCachedBarcodeSvg(item.product.barcode, showBarcodeText, barcodeFontSize);
          
          const labelHtml = `
            <div class="label">
              <div class="label-content">
                <div class="label-text">
                  ${showBusinessName ? `<div class="business-name" style="font-size: ${bnameSize}px">${settings?.company_name || userStore?.store_name || 'Mi Negocio'}</div>` : ''}
                  ${showProductName ? `<div class="product-name" style="font-size: ${pnameSize}px">${item.product.name}</div>` : ''}
                  ${showPrice ? `<div class="product-price" style="font-size: ${priceSize}px">$${(item.product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
                </div>
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
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #fff;
              }
              
              .labels-container {
                display: grid;
                grid-template-columns: repeat(${columns}, ${printW}mm);
                column-gap: ${gapX}mm;
                row-gap: ${gapY}mm;
                /* Center block only if multiple columns */
                ${columns > 1 ? 'justify-content: center; padding-top: 10mm;' : ''}
                width: max-content;
                max-width: 100%;
              }

              .label {
                width: ${printW}mm;
                height: ${printH}mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                background: white;
                box-sizing: border-box;
                padding: 0; /* Padding moved to inner content to avoid rotation clipping */
                border: 1px dotted #ccc; 
              }

              .label-content {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                width: ${labelWidth}mm;
                height: ${labelHeight}mm;
                padding: 1.5mm;
                box-sizing: border-box;
                ${rotation !== 0 ? `transform: rotate(${rotation}deg);` : ''}
              }

              .label-text {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                width: 100%;
                text-align: center;
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
                max-height: 26px; /* Max 2 lines */
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
              }

              .barcode-container svg {
                max-width: 100%;
                max-height: ${labelHeight * (showProductName ? 0.4 : 0.65)}mm; 
                width: auto;
                height: auto;
                display: block;
              }

              /* Page rules for thermal continuous vs defined A4 */
              @page {
                size: ${columns === 1 ? (printW + 'mm ' + printH + 'mm') : 'A4'};
                margin: 0;
              }

              @media print {
                html, body {
                  width: ${columns === 1 ? printW + 'mm' : '100%'};
                  margin: 0;
                  padding: 0;
                }
                .label {
                  page-break-inside: avoid;
                  break-inside: avoid;
                  border: none; /* remove cutting borders for clean print */
                }
                
                /* Adjust for Thermal cuts if single row */
                .labels-container {
                   row-gap: ${columns === 1 ? '0mm' : gapY + 'mm'};
                }
                ${columns === 1 ? `
                  .label { 
                    page-break-after: always; 
                  }
                ` : ''}
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
  const filteredPrintList = useMemo(() =>
    printList.filter(item =>
      item.product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (item.product.barcode?.toLowerCase() || '').includes(debouncedSearch.toLowerCase())
    ),
    [printList, debouncedSearch]
  );

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
      max-height: ${labelHeight * (showProductName ? 0.4 : 0.65)}mm;
    }
  `, [labelHeight, showProductName]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] sm:h-[auto] max-h-[90vh] flex flex-col p-0">
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
          <ScrollArea className="flex-1 px-6 pb-6 md:w-[60%] lg:w-[65%]">
            <div className="space-y-6 pt-4">
              {/* Plantillas rápidas */}
            <div className="space-y-3 bg-secondary/30 p-4 rounded-lg">
              <Label className="flex items-center gap-2 font-semibold">
                <Settings className="w-4 h-4" /> Plantillas Rápidas
              </Label>
              <Select onValueChange={applyProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar un tipo de papel..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermal">Impresora Térmica Estandar (50x30mm)</SelectItem>
                  <SelectItem value="thermal_small">Impresora Térmica Pequeña (30x20mm)</SelectItem>
                  <SelectItem value="a4_3x10">Hoja A4 - 3 Columnas (Planilla tipo Avery)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                </div>
              </div>
            </div>
            
            {/* Lista de selección interactiva */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-1">
                <h4 className="font-semibold text-sm">3. Productos y Cantidad</h4>
                <div className="flex gap-2 text-xs">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const filteredIds = filteredPrintList.map(i => i.product.id);
                    setPrintList(prev => prev.map(i => filteredIds.includes(i.product.id) ? {...i, selected: true} : i));
                  }} className="h-6 px-2 text-xs">Marcar Todos</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const filteredIds = filteredPrintList.map(i => i.product.id);
                    setPrintList(prev => prev.map(i => filteredIds.includes(i.product.id) ? {...i, selected: false} : i));
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
              
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-background">
                {filteredPrintList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 px-2">No se encontraron productos.</p>
                ) : (
                  filteredPrintList.map((item) => (
                    <div key={item.product.id} className={`flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors border-transparent border`}
                      onClick={() => {
                        setPrintList(prev => prev.map(i => i.product.id === item.product.id ? {...i, selected: !i.selected} : i));
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Checkbox 
                          checked={item.selected} 
                          onCheckedChange={(c) => {
                            setPrintList(prev => prev.map(i => i.product.id === item.product.id ? {...i, selected: !!c} : i));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex flex-col overflow-hidden min-w-[120px]">
                          <span className="text-sm font-medium truncate" title={item.product.name}>{item.product.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{item.product.barcode} - ${(item.product.price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-xs">
              <p><strong>Truco Térmico:</strong> Si usas impresora térmica continua (1 columna), asegúrate que el navegador no agregue márgenes ni encaboezados propios (Desactiva "Headers/Footers" y pon "Margins: None" en el diálogo de sistema).</p>
            </div>
          </div>
          </ScrollArea>
          
          <div className="md:w-[45%] lg:w-[45%] flex flex-col overflow-hidden bg-muted/20 border-l">
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
             
             <ScrollArea className="flex-1 bg-zinc-100 dark:bg-zinc-900 overflow-auto">
                {/* Un solo bloque de estilo compartido para todos los barcodes de la vista previa */}
                <style dangerouslySetInnerHTML={{ __html: previewBarcodeStyle }} />
                <div className="p-8 flex items-start justify-center min-w-max min-h-full">
                   {previewLabels.length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                        No hay etiquetas para mostrar
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
                                  dangerouslySetInnerHTML={{ __html: getCachedBarcodeSvg(prod.barcode, showBarcodeText, barcodeFontSize) }} 
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
