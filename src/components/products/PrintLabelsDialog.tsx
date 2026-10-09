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

  // Calibración y desplazamientos para centrado en etiquetas térmicas
  const [offsetY, setOffsetY] = useState<number>(savedSettings.offsetY ?? 0); // Desplazamiento Y en mm (-15 a +15)
  const [offsetX, setOffsetX] = useState<number>(savedSettings.offsetX ?? 0); // Desplazamiento X en mm (-15 a +15)
  const [contentPadding, setContentPadding] = useState<number>(savedSettings.contentPadding ?? (savedSettings.labelHeight && savedSettings.labelHeight <= 22 ? 0.8 : 1.2)); // Margen interior en mm

  // Persistir settings con debounce — evita escribir localStorage en cada keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('cobro_label_settings', JSON.stringify({
        labelWidth, labelHeight, columns, gapX, gapY,
        showBusinessName, showProductName, showPrice, showBarcodeText, rotation,
        bnameSize, pnameSize, priceSize, barcodeFontSize,
        barHeight, barWidth, selectedTemplateId,
        offsetY, offsetX, contentPadding
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [labelWidth, labelHeight, columns, gapX, gapY, showBusinessName, showProductName, showPrice, showBarcodeText, rotation, bnameSize, pnameSize, priceSize, barcodeFontSize, barHeight, barWidth, selectedTemplateId, offsetY, offsetX, contentPadding]);

  // Si la etiqueta es pequeña (<= 22mm) y trae valores antiguos sobredimensionados, auto-adaptar
  useEffect(() => {
    if (labelHeight <= 22 && (barHeight > 22 || priceSize > 12 || pnameSize > 9 || barWidth > 1.2)) {
      setBarHeight(18);
      setBarWidth(1.1);
      setPnameSize(8);
      setPriceSize(11);
      setBarcodeFontSize(8);
      setShowBusinessName(false);
      setContentPadding(0.8);
      setRotation(0);
    }
  }, [labelHeight, barHeight, priceSize, pnameSize, barWidth]);

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
      setGapY(0);
      setRotation(0);
      setShowBusinessName(true);
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(9);
      setPnameSize(10);
      setPriceSize(14);
      setBarcodeFontSize(10);
      setBarHeight(32);
      setBarWidth(1.4);
      setOffsetY(0);
      setOffsetX(0);
      setContentPadding(1.2);
    } else if (profileId === 'thermal_small') {
      setLabelWidth(30);
      setLabelHeight(20);
      setColumns(1);
      setGapX(0);
      setGapY(0);
      setRotation(0);
      setShowBusinessName(false); // En 20mm no cabe el nombre de negocio junto al producto y barcode
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(7);
      setPnameSize(8);
      setPriceSize(11);
      setBarcodeFontSize(8);
      setBarHeight(18);
      setBarWidth(1.1);
      setOffsetY(0);
      setOffsetX(0);
      setContentPadding(0.8);
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
      setOffsetY(0);
      setOffsetX(0);
      setContentPadding(1.5);
    } else {
      // Buscar plantilla personalizada
      const template = customTemplates.find(t => t.id === profileId);
      if (template) {
        setLabelWidth(template.labelWidth);
        setLabelHeight(template.labelHeight);
        setColumns(template.columns);
        setGapX(template.gapX);
        setGapY(template.gapY);
        setRotation(template.rotation ?? 0);
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
        setOffsetY(template.offsetY ?? 0);
        setOffsetX(template.offsetX ?? 0);
        setContentPadding(template.contentPadding ?? 1.0);
      }
    }
  }, [customTemplates]);

  // Auto-optimizar fuentes y código según la altura actual de la etiqueta
  const handleAutoOptimize = useCallback(() => {
    if (labelHeight <= 22) {
      setShowBusinessName(false);
      setShowProductName(true);
      setShowPrice(true);
      setShowBarcodeText(true);
      setBnameSize(7);
      setPnameSize(8);
      setPriceSize(11);
      setBarcodeFontSize(8);
      setBarHeight(18);
      setBarWidth(1.1);
      setContentPadding(0.8);
      setRotation(0);
      setOffsetY(0);
      setOffsetX(0);
    } else if (labelHeight <= 35) {
      setBnameSize(9);
      setPnameSize(10);
      setPriceSize(14);
      setBarcodeFontSize(10);
      setBarHeight(30);
      setBarWidth(1.4);
      setContentPadding(1.2);
    } else {
      setBnameSize(10);
      setPnameSize(11);
      setPriceSize(16);
      setBarcodeFontSize(12);
      setBarHeight(40);
      setBarWidth(1.6);
      setContentPadding(1.5);
    }
    toast({
      title: "Medidas optimizadas",
      description: `Se han adaptado las fuentes y código para una altura de ${labelHeight}mm.`
    });
  }, [labelHeight, toast]);

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
      barWidth,
      offsetY,
      offsetX,
      contentPadding
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



  const [isDirectPrinting, setIsDirectPrinting] = useState(false);

  // Impresión directa a la 4BARCODE por comandos TSPL crudos (100% centrado, 1 solo label, sin depender de Chrome)
  const handleDirectTsplPrint = async () => {
    const selected = printList.filter(item => item.selected && item.quantity > 0);
    if (selected.length === 0) {
      toast({
        title: "Sin productos seleccionados",
        description: "Selecciona al menos un producto para imprimir.",
        variant: "destructive"
      });
      return;
    }

    setIsDirectPrinting(true);
    try {
      const is30x20 = labelWidth <= 35 && labelHeight <= 25;
      const tsplCommands: string[] = [
        `SIZE ${labelWidth} mm,${labelHeight} mm`,
        `GAP 2 mm,0 mm`,
        `DIRECTION 1`,
        `REFERENCE 0,0`,
        `OFFSET 0 mm`,
        `SHIFT 0`,
        `SET TEAR ON`,
        `DENSITY 8`,
        `SPEED 3`
      ];

      for (const item of selected) {
        for (let q = 0; q < item.quantity; q++) {
          const dotsW = Math.round(labelWidth * 8); // 240 dots para 30mm
          const dotsH = Math.round(labelHeight * 8); // 160 dots para 20mm

          // Limpiar caracteres especiales de nombre
          const cleanName = (item.product.name || '').substring(0, is30x20 ? 22 : 35).replace(/["\\]/g, '');
          const nameDots = cleanName.length * 8;
          const nameX = Math.max(6, Math.round((dotsW - nameDots) / 2) + Math.round(offsetX * 8));
          const nameY = Math.max(8, 16 + Math.round(offsetY * 8));

          // Precio
          const priceText = `$${(item.product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const priceDots = priceText.length * 12;
          const priceX = Math.max(6, Math.round((dotsW - priceDots) / 2) + Math.round(offsetX * 8));
          const priceY = Math.max(24, 34 + Math.round(offsetY * 8));

          // Barcode (Code128)
          const bc = (item.product.barcode || '').trim().replace(/["\\]/g, '');
          const narrow = (bc.length > 10 || is30x20) ? 1 : 2;
          const estBcWidth = (35 + bc.length * 11) * narrow;
          const bcX = Math.max(6, Math.round((dotsW - estBcWidth) / 2) + Math.round(offsetX * 8));
          const bcY = Math.max(46, 56 + Math.round(offsetY * 8));
          const bcH = is30x20 ? 38 : 50;

          tsplCommands.push('CLS');
          if (showProductName) {
            tsplCommands.push(`TEXT ${nameX},${nameY},"1",0,1,1,"${cleanName}"`);
          }
          if (showPrice) {
            tsplCommands.push(`TEXT ${priceX},${priceY},"2",0,1,1,"${priceText}"`);
          }
          if (bc) {
            tsplCommands.push(`BARCODE ${bcX},${bcY},"128",${bcH},1,0,${narrow},${narrow},"${bc}"`);
          }
          tsplCommands.push('PRINT 1,1');
        }
      }

      const res = await fetch('/api/print-raw-tspl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: '4BARCODE 4B-2074B',
          tspl: tsplCommands.join('\r\n') + '\r\n'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "¡Etiqueta impresa correctamente!",
          description: `Se enviaron ${totalLabelsToPrint} etiqueta(s) directo a la 4BARCODE (1 solo sticker, perfectamente centrado).`,
        });
      } else {
        throw new Error(data.error || 'No se pudo comunicar con la impresora.');
      }
    } catch (e: any) {
      console.warn("Fallo impresión directa TSPL, usando fallback de ventana:", e);
      toast({
        title: "Impresora directa no disponible",
        description: "Abriendo la ventana de impresión del navegador...",
      });
      handlePrint();
    } finally {
      setIsDirectPrinting(false);
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
        const isSmallHeight = labelHeight <= 25;

        // Auto-clamp estricto para garantizar que el contenido NUNCA supere el alto del papel ni se divida en dos páginas
        const effectiveBarHeight = labelHeight <= 22 ? Math.min(barHeight, 14) : (labelHeight <= 30 ? Math.min(barHeight, 26) : barHeight);
        const effectiveBarWidth = labelWidth <= 35 ? Math.min(barWidth, 1.0) : (labelWidth <= 45 ? Math.min(barWidth, 1.3) : barWidth);
        const effectivePnameSize = labelHeight <= 22 ? Math.min(pnameSize, 7.5) : (labelHeight <= 30 ? Math.min(pnameSize, 10) : pnameSize);
        const effectivePriceSize = labelHeight <= 22 ? Math.min(priceSize, 10) : (labelHeight <= 30 ? Math.min(priceSize, 13) : priceSize);
        const effectiveBarcodeFontSize = labelHeight <= 22 ? Math.min(barcodeFontSize, 7) : barcodeFontSize;
        const effectiveShowBusinessName = labelHeight <= 22 ? false : showBusinessName;
        const labelNetHeight = columns === 1 ? (labelHeight <= 22 ? 16 : Math.max(10, printH - 1.2)) : printH;

        const labelsHtml = selectedItems.flatMap(item => {
          const barcodeSvg = getCachedBarcodeSvg(
            item.product.barcode,
            showBarcodeText,
            effectiveBarcodeFontSize,
            effectiveBarHeight,
            effectiveBarWidth
          );

          // Si el nombre del producto es largo y la etiqueta es pequeña, reducimos la fuente para que quepa completa
          const nameLen = (item.product.name || '').length;
          const dynamicPnameSize = isSmallHeight && nameLen > 18 
            ? Math.max(6.0, effectivePnameSize - 1.0) 
            : effectivePnameSize;

          const labelHtml = `
            <div class="label">
              <div class="label-content">
                ${effectiveShowBusinessName ? `<div class="business-name" style="font-size: ${bnameSize}px">${settings?.company_name || userStore?.store_name || 'Mi Negocio'}</div>` : ''}
                <div class="product-name" style="font-size: ${dynamicPnameSize}px" title="${item.product.name}">${item.product.name}</div>
                ${showPrice ? `<div class="product-price" style="font-size: ${effectivePriceSize}px">$${(item.product.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
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
              html, body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #fff;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              @page {
                size: ${columns === 1 ? (printW + 'mm ' + printH + 'mm') : 'A4'};
                margin: 0 !important;
              }

              .labels-container {
                display: ${columns === 1 ? 'block' : 'grid'};
                ${columns === 1 
                  ? 'width: 100%; margin: 0; padding: 0;' 
                  : `grid-template-columns: repeat(${columns}, ${printW}mm); column-gap: ${gapX}mm; row-gap: ${gapY}mm; justify-content: center; padding-top: 10mm; width: max-content;`
                }
                max-width: 100%;
              }

              .label {
                width: ${printW}mm;
                height: ${labelNetHeight}mm;
                max-height: ${labelNetHeight}mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden !important;
                background: white;
                box-sizing: border-box;
                padding: 0;
                margin: 0 auto;
                position: relative;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                border: ${columns > 1 ? '1px dotted #ccc' : 'none'};
              }

              .label:not(:last-child) {
                page-break-after: always !important;
                break-after: page !important;
              }

              .label:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }

              .label-content {
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
                width: 100% !important;
                height: 100% !important;
                max-height: 100% !important;
                gap: 0.5mm !important;
                padding-top: ${Math.max(0, 0.4 + offsetY)}mm !important;
                padding-bottom: ${Math.max(0, 0.4 - offsetY)}mm !important;
                padding-left: ${Math.max(0.4, 0.4 + offsetX)}mm !important;
                padding-right: ${Math.max(0.4, 0.4 - offsetX)}mm !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              .label-content * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              .business-name {
                font-weight: bold;
                text-transform: uppercase;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                text-align: center;
                line-height: 1;
                margin: 0;
                padding: 0;
                flex-shrink: 0;
              }

              .product-name {
                line-height: 1.0;
                margin: 0;
                padding: 0 0.5mm;
                width: 100%;
                max-width: 100%;
                text-align: center;
                flex-shrink: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                box-sizing: border-box;
              }

              .product-price {
                font-weight: 800;
                margin: 0;
                padding: 0;
                text-align: center;
                line-height: 1.0;
                width: 100%;
                flex-shrink: 0;
              }

              .barcode-container {
                display: flex;
                justify-content: center;
                align-items: center;
                flex-shrink: 0;
                width: 100%;
                max-width: 100%;
                overflow: hidden;
                margin: 0;
                padding: 0;
              }

              .barcode-container svg {
                max-width: 95%;
                max-height: ${isSmallHeight ? 6.5 : Math.max(5, Math.min(labelHeight * barcodeMaxHeightMultiplier, effectiveBarHeight * 0.45))}mm; 
                width: auto;
                height: auto;
                display: block;
              }

              @media print {
                html, body {
                  width: ${columns === 1 ? printW + 'mm' : '100%'} !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                  background-color: #fff !important;
                }
                
                ${columns === 1 ? `
                  .labels-container {
                    display: block !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  .label {
                    display: flex !important;
                    width: ${printW}mm !important;
                    height: ${labelNetHeight}mm !important;
                    max-height: ${labelNetHeight}mm !important;
                    border: none !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  .label:not(:last-child) {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                  .label:last-child {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                  }
                  .label-content {
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: center !important;
                    align-items: center !important;
                    width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    gap: 0.5mm !important;
                    padding-top: ${Math.max(0, 0.4 + offsetY)}mm !important;
                    padding-bottom: ${Math.max(0, 0.4 - offsetY)}mm !important;
                    padding-left: ${Math.max(0.4, 0.4 + offsetX)}mm !important;
                    padding-right: ${Math.max(0.4, 0.4 - offsetX)}mm !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
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
      max-height: ${Math.max(5, Math.min(labelHeight * barcodeMaxHeightMultiplier, barHeight * 0.45))}mm;
      display: block;
    }
  `, [labelHeight, barcodeMaxHeightMultiplier, barHeight]);

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

                  {/* 3. Calibración y Centrado */}
                  <div className="space-y-4 sm:col-span-2 bg-muted/40 p-3 rounded-lg border">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm">3. Calibración y Centrado Fino (Milímetros)</h4>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAutoOptimize}
                        className="h-7 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                      >
                        ✨ Auto-Ajustar para {labelHeight}mm
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      {/* Desplazamiento Vertical */}
                      <div className="space-y-1.5 bg-background p-2.5 rounded-md border">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold">Ajuste Vertical (Y)</Label>
                          <span className="text-[11px] font-mono text-muted-foreground">{offsetY > 0 ? `+${offsetY}` : offsetY} mm</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Sube (-) o baja (+) el diseño en la etiqueta física.
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOffsetY(prev => Number((prev - 1).toFixed(1)))}>-1mm</Button>
                          <Input
                            type="number"
                            step="0.5"
                            min="-15"
                            max="15"
                            className="h-7 text-xs text-center font-mono"
                            value={offsetY}
                            onChange={(e) => setOffsetY(Number(e.target.value))}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOffsetY(prev => Number((prev + 1).toFixed(1)))}>+1mm</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] text-muted-foreground" onClick={() => setOffsetY(0)}>0</Button>
                        </div>
                      </div>

                      {/* Desplazamiento Horizontal */}
                      <div className="space-y-1.5 bg-background p-2.5 rounded-md border">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold">Ajuste Horizontal (X)</Label>
                          <span className="text-[11px] font-mono text-muted-foreground">{offsetX > 0 ? `+${offsetX}` : offsetX} mm</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Mueve a la izq (-) o der (+) para centrar en el rollo.
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOffsetX(prev => Number((prev - 1).toFixed(1)))}>-1mm</Button>
                          <Input
                            type="number"
                            step="0.5"
                            min="-15"
                            max="15"
                            className="h-7 text-xs text-center font-mono"
                            value={offsetX}
                            onChange={(e) => setOffsetX(Number(e.target.value))}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setOffsetX(prev => Number((prev + 1).toFixed(1)))}>+1mm</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] text-muted-foreground" onClick={() => setOffsetX(0)}>0</Button>
                        </div>
                      </div>

                      {/* Margen Interior */}
                      <div className="space-y-1.5 bg-background p-2.5 rounded-md border">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold">Margen Interno (Padding)</Label>
                          <span className="text-[11px] font-mono text-muted-foreground">{contentPadding} mm</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Margen de seguridad dentro de la etiqueta.
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setContentPadding(prev => Math.max(0, Number((prev - 0.2).toFixed(1))))}>-0.2</Button>
                          <Input
                            type="number"
                            step="0.2"
                            min="0"
                            max="5"
                            className="h-7 text-xs text-center font-mono"
                            value={contentPadding}
                            onChange={(e) => setContentPadding(Math.max(0, Number(e.target.value)))}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setContentPadding(prev => Math.min(5, Number((prev + 0.2).toFixed(1))))}>+0.2</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] text-muted-foreground" onClick={() => setContentPadding(labelHeight <= 22 ? 0.8 : 1.2)}>Reset</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de selección interactiva */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-1">
                  <h4 className="font-semibold text-sm">4. Productos y Cantidad</h4>
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

              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-3.5 rounded-lg text-xs space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <span>💡</span> ¿El sticker sale corrido o cortado? (Impresoras 4BARCODE / Térmicas):
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90 pl-1">
                  <li><strong>Ajuste Fino de Posición:</strong> Si el contenido se corta arriba o abajo, usa los botones de <strong>Ajuste Vertical (Y)</strong> (+ / - mm) de arriba para centrarlo al milímetro.</li>
                  <li><strong>Calibrar Sensor de la Impresora:</strong> Con la impresora encendida y el papel puesto, mantén pulsado el botón <em>FEED</em> hasta que suenen 2 pitidos y suelta. La impresora avanzará 2 stickers y calibrará el sensor de separación (gap).</li>
                  <li><strong>Controlador Windows (Seagull):</strong> En Preferencias de Impresión &gt; pestaña <em>Material</em>, asegúrate de que el Tipo de soporte sea <strong>"Etiquetas con separación"</strong> (con 2mm o 3mm de espacio).</li>
                  <li><strong>Diálogo de Imprimir del Navegador:</strong> Márgenes: <em>Ninguno</em> y Escala: <em>Predeterminado (100%)</em>.</li>
                </ul>
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
                        <div
                          className="relative flex flex-col items-center justify-evenly text-center overflow-hidden text-black"
                          style={{
                            width: `${labelWidth}mm`,
                            height: `${labelHeight}mm`,
                            paddingTop: `${Math.max(0, (labelHeight <= 22 ? 3.5 : 1.5) + offsetY)}mm`,
                            paddingBottom: `${Math.max(0, 0.5 - offsetY)}mm`,
                            paddingLeft: `${Math.max(0.5, 0.5 + offsetX)}mm`,
                            paddingRight: `${Math.max(0.5, 0.5 - offsetX)}mm`,
                            boxSizing: 'border-box'
                          }}
                        >
                          {(labelHeight <= 22 ? false : showBusinessName) && (
                            <div className="font-bold uppercase w-full text-center truncate shrink-0" style={{ fontSize: `${bnameSize}px`, lineHeight: 1 }}>
                              {settings?.company_name || userStore?.store_name || 'Mi Negocio'}
                            </div>
                          )}
                          {showProductName && (
                            <div
                              className="w-full text-center leading-tight shrink-0 px-0.5 truncate"
                              style={{
                                fontSize: `${(labelHeight <= 25 && (prod.name || '').length > 18) ? Math.max(6.5, (labelHeight <= 22 ? Math.min(pnameSize, 8) : pnameSize) - 1.2) : (labelHeight <= 22 ? Math.min(pnameSize, 8) : pnameSize)}px`,
                                lineHeight: 1.1
                              }}
                              title={prod.name}
                            >
                              {prod.name}
                            </div>
                          )}
                          {showPrice && (
                            <div className="font-extrabold w-full text-center shrink-0" style={{ fontSize: `${labelHeight <= 22 ? Math.min(priceSize, 11) : priceSize}px`, lineHeight: 1 }}>
                              ${(prod.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          <div
                            className="w-full flex justify-center items-center shrink preview-barcode-container overflow-hidden"
                            dangerouslySetInnerHTML={{
                              __html: getCachedBarcodeSvg(
                                prod.barcode,
                                showBarcodeText,
                                labelHeight <= 22 ? Math.min(barcodeFontSize, 8) : barcodeFontSize,
                                labelHeight <= 22 ? Math.min(barHeight, 16) : barHeight,
                                labelWidth <= 35 ? Math.min(barWidth, 1.05) : barWidth
                              )
                            }}
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

        <DialogFooter className="p-6 pt-4 border-t bg-secondary/20 shrink-0 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPrinting || isDirectPrinting}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isPrinting || isDirectPrinting}
            className="border-primary/40 text-foreground hover:bg-primary/10"
            title="Abre la ventana de impresión tradicional de Chrome"
          >
            {isPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            {isPrinting ? "Generando..." : "Imprimir con Navegador"}
          </Button>
          <Button
            onClick={handleDirectTsplPrint}
            disabled={isPrinting || isDirectPrinting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            title="Envía los comandos térmicos crudos directamente a la impresora 4BARCODE (1 solo sticker, centrado perfecto y sin pasar por Chrome)"
          >
            {isDirectPrinting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2 text-white" />}
            {isDirectPrinting ? "Enviando a Impresora..." : "⚡ Imprimir Directo (4BARCODE)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
