import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/ThemeProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useInvoiceSequences, useUpdateInvoiceSequence, useMaxInvoiceNumbers } from '@/hooks/useInvoiceSequences';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { offlineDB, OfflineStore } from "@/lib/offlineDB";
import { useUserStore } from '@/hooks/useUserStore';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useStoreSettings, PaymentMethod } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ThermalPrinterDialog } from '@/components/settings/ThermalPrinterDialog';
import { isAndroidNative } from '@/utils/platform';
import { PrintSettingsDialog } from '@/components/settings/PrintSettingsDialog';
import { sendEvolutionWhatsAppMessage } from '@/utils/evolutionApi';
import { EvolutionQRDialog } from '@/components/settings/EvolutionQRDialog';
import MobileSettingsLayout from '@/components/settings/MobileSettingsLayout';
import SettingsStoreSection from '@/components/settings/SettingsStoreSection';
import BannerSettingsSection from '@/components/settings/BannerSettingsSection';
import StoreHoursSection from '@/components/settings/StoreHoursSection';
import { AiSettingsSection } from '@/components/settings/AiSettingsSection';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InvoiceSequenceInput } from '@/components/settings/InvoiceSequenceInput';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { LoadingLogo } from '@/components/ui/loading-logo';
import {
  Building2,
  FileText,
  Calculator,
  Sparkles,
  CreditCard,
  Package,
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Printer,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Hash,
  Store,
  Copy,
  ExternalLink,
  Share2,
  Volume2,
  Mail,
  Send,
  Clock,
  Image as ImageIcon,
  ChefHat,
  Timer,
  Plus,
  Trash2,
  Edit,
  Bike,
  CheckCircle2,
  LayoutGrid,
  QrCode,
  Search,
  Loader2,
  Smartphone
} from 'lucide-react';
import { injectPrintStyles } from '@/utils/printHandler';
import BillingMethodSection from '@/components/settings/BillingMethodSection';
import { useAlanubeConfig } from '@/hooks/useAlanubeConfig';
import { lookupRnc } from '@/lib/rncLookup';

const Settings = () => {
  const [qrConnectionStatus, setQrConnectionStatus] = useState<'disconnected' | 'connected' | 'checking'>('disconnected');
  const [testWhatsAppPhone, setTestWhatsAppPhone] = useState('');
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme, scale, setScale } = useTheme();
  const isMobile = useIsMobile();
  const [mobileActiveSection, setMobileActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const queryClient = useQueryClient();

  // Hooks for invoice sequences
  const { data: invoiceSequences, isLoading: sequencesLoading } = useInvoiceSequences();
  const { data: invoiceTypes } = useInvoiceTypes();
  const { data: maxInvoiceNumbers } = useMaxInvoiceNumbers();
  const updateSequenceMutation = useUpdateInvoiceSequence();

  // User profile and store hooks
  const { profile } = useUserProfile();
  const { data: userStore, isLoading: storeLoading } = useUserStore();
  const { settings: companySettingsDB, updateSettings, isUpdating, uploadLogo, isUploadingLogo, isLoading: companySettingsLoading } = useCompanySettings();
  const { settings: storeSettings, updateSettings: updateStoreSettings, isUpdating: isUpdatingStoreSettings, loadingSettings } = useStoreSettings();

  // Category hooks
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', description: '' });

  // Alanube Config
  const { config: alanubeConfig } = useAlanubeConfig();
  const [localBillingMode, setLocalBillingMode] = useState<'ncf' | 'e-ncf'>('ncf');

  // Sync billing mode from database config
  useEffect(() => {
    if (alanubeConfig) {
      setLocalBillingMode(alanubeConfig.is_active ? 'e-ncf' : 'ncf');
    }
  }, [alanubeConfig]);

  // Company Information State - sync with database
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Mi Empresa',
    rnc: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    logo: '',
    slogan: '',
    metaDescription: '',
    socialFacebook: '',
    socialInstagram: '',
    socialTwitter: '',
    logoSize: 120,
    logoCartSize: 200,
    logoSummarySize: 64,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [shopType, setShopType] = useState('default');
  const [isLookingUpCompanyRnc, setIsLookingUpCompanyRnc] = useState(false);

  const handleLookupCompanyRnc = async () => {
    if (!companyInfo.rnc?.trim()) return;
    setIsLookingUpCompanyRnc(true);
    try {
      const result = await lookupRnc(companyInfo.rnc);
      if (result.success && result.name) {
        setCompanyInfo(prev => ({ ...prev, name: result.name! }));
        toast({
          title: "Empresa encontrada",
          description: `Nombre: ${result.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Consulta fallida",
          description: result.error || "No se encontró empresa con este RNC/Cédula.",
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error de conexión al consultar.",
      });
    } finally {
      setIsLookingUpCompanyRnc(false);
    }
  };

  // Sync company settings from database to local state
  useEffect(() => {
    if (companySettingsDB) {
      const dbSettings = {
        name: companySettingsDB.company_name || userStore?.store_name || 'Mi Empresa',
        rnc: companySettingsDB.rnc || profile?.rnc || '',
        phone: companySettingsDB.phone || '',
        email: companySettingsDB.email || '',
        address: companySettingsDB.address || '',
        website: companySettingsDB.website || '',
        logo: companySettingsDB.logo_url || '',
        slogan: companySettingsDB.slogan || '',
        metaDescription: companySettingsDB.meta_description || '',
        socialFacebook: companySettingsDB.social_facebook || '',
        socialInstagram: companySettingsDB.social_instagram || '',
        socialTwitter: companySettingsDB.social_twitter || '',
        logoSize: companySettingsDB.logo_invoice_size || 120,
        logoCartSize: companySettingsDB.logo_cart_size || 200,
        logoSummarySize: companySettingsDB.logo_summary_size || 64,
      };
      setCompanyInfo(dbSettings);
      setLogoPreview(companySettingsDB.logo_url || null);
    } else if (userStore) {
      setCompanyInfo(prev => ({
        ...prev,
        name: userStore.store_name || prev.name,
        rnc: profile?.rnc || prev.rnc,
      }));
    }
  }, [companySettingsDB, userStore, profile?.rnc]);

  // Invoice Settings State - synced with storeSettings
  const [invoiceSettings, setInvoiceSettings] = useState({
    nextInvoiceNumber: '0001',
    invoicePrefix: 'FAC-',
    autoIncrement: true,
    showTax: true,
    defaultTaxRate: '18',
    currency: 'DOP',
    paymentTerms: '15',
    footerText: 'Gracias por su preferencia',
    emailGreeting: '¡Hola!',
    emailMessage: 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.',
    showBarcode: false
  });

  // Sync invoice settings from database
  // Sync invoice settings from database
  useEffect(() => {
    if (storeSettings) {
      // Load local settings
      let localSettings: any = {};
      try {
        localSettings = JSON.parse(localStorage.getItem('invoice_settings_local') || '{}');
      } catch (e) {
        console.error('Error parsing invoice_settings_local', e);
      }

      setInvoiceSettings({
        nextInvoiceNumber: '0001',
        invoicePrefix: storeSettings.invoice_prefix || 'FAC-',
        autoIncrement: storeSettings.auto_increment ?? true,
        showTax: storeSettings.show_tax ?? true,
        defaultTaxRate: storeSettings.default_tax_rate != null ? String(storeSettings.default_tax_rate) : '18',
        currency: storeSettings.currency || 'DOP',
        paymentTerms: storeSettings.payment_terms != null ? String(storeSettings.payment_terms) : '15',
        footerText: storeSettings.invoice_footer_text || 'Gracias por su preferencia',
        emailGreeting: storeSettings.email_greeting || '¡Hola!',
        emailMessage: storeSettings.email_message || 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.',
        showBarcode: storeSettings.show_barcode || localSettings.showBarcode || false // Load from DB or Local
      });
      setShopType(storeSettings.shop_type || 'default');
    }
  }, [
    storeSettings?.invoice_prefix,
    storeSettings?.auto_increment,
    storeSettings?.show_tax,
    storeSettings?.default_tax_rate,
    storeSettings?.currency,
    storeSettings?.payment_terms,
    storeSettings?.invoice_footer_text,
    storeSettings?.email_greeting,
    storeSettings?.email_message,
    storeSettings?.shop_type,
    storeSettings?.show_barcode // NEW: Watch for changes
  ]);

  // System Settings State - synced with storeSettings
  const [systemSettings, setSystemSettings] = useState({
    notifications: true,
    autoBackup: true,
    lowStockAlert: true,
    lowStockThreshold: '10',
    theme: 'dark',
    language: 'es',
    timezone: 'America/Santo_Domingo',
    backupFrequency: 'daily',
    retentionDays: '30',
    posLayoutGridCols: '2',
    aiApiKey: ''
  });

  const [kitchenSettings, setKitchenSettings] = useState({
    yellowThreshold: 5,
    redThreshold: 10,
    alertThreshold: 15
  });

  // Sync system settings from database
  useEffect(() => {
    if (storeSettings) {
      setSystemSettings({
        notifications: storeSettings.notifications_enabled ?? true,
        autoBackup: storeSettings.auto_backup ?? false,
        lowStockAlert: storeSettings.low_stock_alert ?? false,
        lowStockThreshold: storeSettings.low_stock_threshold != null ? String(storeSettings.low_stock_threshold) : '10',
        theme: storeSettings.theme || 'light',
        language: storeSettings.language || 'es',
        timezone: storeSettings.timezone || 'America/Santo_Domingo',
        backupFrequency: storeSettings.backup_frequency || 'daily',
        retentionDays: storeSettings.log_retention_days != null ? String(storeSettings.log_retention_days) : '30',
        posLayoutGridCols: storeSettings.pos_layout_grid_cols != null ? String(storeSettings.pos_layout_grid_cols) : '2',
        aiApiKey: storeSettings.ai_api_key || '',
      });

      // Sync kitchen settings
      setKitchenSettings({
        yellowThreshold: storeSettings.kitchen_yellow_threshold || 5,
        redThreshold: storeSettings.kitchen_red_threshold || 10,
        alertThreshold: storeSettings.kitchen_alert_threshold || 15
      });
    }
  }, [
    storeSettings?.notifications_enabled,
    storeSettings?.auto_backup,
    storeSettings?.low_stock_alert,
    storeSettings?.low_stock_threshold,
    storeSettings?.theme,
    storeSettings?.language,
    storeSettings?.timezone,
    storeSettings?.kitchen_yellow_threshold,
    storeSettings?.kitchen_red_threshold,
    storeSettings?.kitchen_alert_threshold
  ]);

  // Payment methods state - synced with storeSettings
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: 'cash', name: 'Efectivo', enabled: true },
    { id: 'card', name: 'Tarjeta', enabled: true },
    { id: 'transfer', name: 'Transferencia', enabled: true },
    { id: 'check', name: 'Cheque', enabled: false },
    { id: 'credit', name: 'Crédito', enabled: true }
  ]);

  // Sync payment methods from database
  useEffect(() => {
    if (storeSettings?.payment_methods) {
      setPaymentMethods(storeSettings.payment_methods);
    }
  }, [storeSettings?.payment_methods]);

  // Print Settings State - synced with storeSettings
  const [printSettings, setPrintSettings] = useState({
    paperSize: '80mm',
    useThermalPrinter: false,
    thermalPrinterConnected: false,
    thermalPrinterName: '',
    pageMargin: '0mm',
    containerPadding: '4px',
    logoMarginTop: '6px',
    logoMarginBottom: '6px',
    logoWidth: 'auto', // Fix TS error by initializing
    fontSize: 12, // Default font size for invoice
  });

  // Sync print settings from database
  useEffect(() => {
    if (storeSettings) {
      const hasPrinterSaved = Boolean(storeSettings.thermal_printer_name);

      console.log('📡 Cargando configuración de impresora desde DB:', {
        thermal_printer_name: storeSettings.thermal_printer_name,
        use_thermal_printer: storeSettings.use_thermal_printer,
        hasPrinterSaved,
      });

      setPrintSettings(prev => {
        // Load local margin settings
        let localMargins: any = {};
        try {
          localMargins = JSON.parse(localStorage.getItem('print_margins_settings') || '{}');
        } catch (e) {
          console.error('Error parsing print_margins_settings', e);
        }

        return {
          ...prev,
          paperSize: storeSettings.paper_size || '80mm',
          useThermalPrinter: storeSettings.use_thermal_printer ?? false,
          thermalPrinterName: storeSettings.thermal_printer_name || '',
          thermalPrinterConnected: hasPrinterSaved,
          // Prioritize LocalStorage -> DB -> Default
          pageMargin: localMargins.pageMargin || storeSettings.page_margin || '0mm',
          containerPadding: localMargins.containerPadding || storeSettings.container_padding || '4px',
          logoMarginTop: localMargins.logoMarginTop || storeSettings.logo_margin_top || '6px',
          logoMarginBottom: localMargins.logoMarginBottom || storeSettings.logo_margin_bottom || '6px',
          logoWidth: localMargins.logoWidth || 'auto', // Load logo width setting
          fontSize: localMargins.fontSize || storeSettings.invoice_font_size || 12, // Load font size
        };
      });

      console.log('✅ Configuración de impresora cargada');
    }
  }, [storeSettings?.paper_size, storeSettings?.use_thermal_printer, storeSettings?.thermal_printer_name]);

  // Thermal printer dialog state
  const [showPrinterDialog, setShowPrinterDialog] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo es muy grande. Máximo 2MB.",
          variant: "destructive",
        });
        return;
      }

      try {
        setLogoUploadError(null);
        // Upload to Supabase storage
        // Upload to Supabase storage
        const publicUrl = await uploadLogo(file);
        const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`; // Bypass cache
        setLogoPreview(urlWithTimestamp);
        setCompanyInfo({ ...companyInfo, logo: urlWithTimestamp });

        toast({
          title: "Logo subido",
          description: "El logo se ha guardado correctamente.",
        });
      } catch (error: any) {
        console.error('Error uploading logo:', error);
        toast({
          title: "Error",
          description: error.message || "No se pudo subir el logo.",
          variant: "destructive",
        });
        setLogoUploadError(error.message || "No se pudo subir el logo. Verifique permisos.");
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettings({ logo_url: null });
      setLogoPreview(null);
      setCompanyInfo({ ...companyInfo, logo: '' });

      toast({
        title: "Logo removido",
        description: "El logo se ha removido correctamente.",
      });
    } catch (error) {
      console.error('Error removing logo:', error);
    }
  };

  const handleSaveSettings = async (section: string) => {
    setLoading(true);
    try {
      if (section === 'empresa') {
        // Save to Supabase database
        await updateSettings({
          company_name: companyInfo.name,
          rnc: companyInfo.rnc || null,
          phone: companyInfo.phone || null,
          email: companyInfo.email || null,
          address: companyInfo.address || null,
          website: companyInfo.website || null,
          slogan: companyInfo.slogan || null,
          meta_description: companyInfo.metaDescription || null,
          social_facebook: companyInfo.socialFacebook || null,
          social_instagram: companyInfo.socialInstagram || null,
          social_twitter: companyInfo.socialTwitter || null,
          logo_invoice_size: companyInfo.logoSize,
          logo_cart_size: companyInfo.logoCartSize,
          logo_summary_size: companyInfo.logoSummarySize,
        });

        // Also sync to localStorage for offline access
        localStorage.setItem('company-info', JSON.stringify(companyInfo));
      } else if (section === 'facturas') {
        // Save local settings (like barcode) to localStorage FIRST to ensure persistence
        let localSettings: any = {};
        try {
          localSettings = JSON.parse(localStorage.getItem('invoice_settings_local') || '{}');
        } catch (e) {
          console.error('Error parsing invoice_settings_local', e);
        }
        localStorage.setItem('invoice_settings_local', JSON.stringify({
          ...localSettings,
          showBarcode: invoiceSettings.showBarcode
        }));

        // Also save print margins & font size since it's now editable in this section
        localStorage.setItem('print_margins_settings', JSON.stringify({
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginTop: printSettings.logoMarginTop,
          logoMarginBottom: printSettings.logoMarginBottom,
          logoWidth: printSettings.logoWidth,
          fontSize: printSettings.fontSize // Save font size FROM INVOICE TAB
        }));

        // Refresh print styles immediately
        injectPrintStyles();

        // Try access DB update, but don't block if it fails (e.g. missing column)
        try {
          await updateStoreSettings({
            invoice_prefix: invoiceSettings.invoicePrefix,
            auto_increment: invoiceSettings.autoIncrement,
            show_tax: invoiceSettings.showTax,
            default_tax_rate: parseFloat(invoiceSettings.defaultTaxRate) || 18,
            currency: invoiceSettings.currency,
            payment_terms: parseInt(invoiceSettings.paymentTerms) || 15,
            email_message: invoiceSettings.emailMessage,
            show_barcode: invoiceSettings.showBarcode,
          });

          // FIX: Also save logo size which is part of company_settings
          await updateSettings({
            logo_invoice_size: companyInfo.logoSize
          });
        } catch (err) {
          console.warn('Database update failed for invoice settings (likely missing columns), but local settings saved.', err);
        }
      } else if (section === 'pagos') {
        // Save payment methods to database
        await updateStoreSettings({
          payment_methods: paymentMethods,
        });
      } else if (section === 'productos') {
        // Save product settings to database
        await updateStoreSettings({
          low_stock_alert: systemSettings.lowStockAlert,
          low_stock_threshold: parseInt(systemSettings.lowStockThreshold) || 10,
        });
      } else if (section === 'sistema') {
        // Save system settings to database
        await updateStoreSettings({
          notifications_enabled: systemSettings.notifications,
          auto_backup: systemSettings.autoBackup,
          theme: systemSettings.theme,
          language: systemSettings.language,
          timezone: systemSettings.timezone,
          backup_frequency: systemSettings.backupFrequency,
          log_retention_days: parseInt(systemSettings.retentionDays) || 30,
          pos_layout_grid_cols: parseInt(systemSettings.posLayoutGridCols) || 2,
          ai_api_key: systemSettings.aiApiKey,
        });
      } else if (section === 'impresion') {
        // Save visual settings to LocalStorage FIRST (as DB likely lacks these columns)
        localStorage.setItem('print_margins_settings', JSON.stringify({
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginTop: printSettings.logoMarginTop,
          logoMarginBottom: printSettings.logoMarginBottom,
          logoWidth: printSettings.logoWidth, // Ensure this is preserved/saved
          fontSize: printSettings.fontSize // Save font size
        }));

        // Save supported print settings to database with try/catch
        try {
          await updateStoreSettings({
            paper_size: printSettings.paperSize,
            use_thermal_printer: printSettings.useThermalPrinter,
            thermal_printer_name: printSettings.thermalPrinterName || null,
            invoice_font_size: printSettings.fontSize, // Save to DB if supported
          });
        } catch (err) {
          console.warn('Database update failed for print settings, but local settings saved.', err);
        }

        // Refresh print styles immediately
        injectPrintStyles();
      } else if (section === 'tienda') {
        await updateStoreSettings({
          shop_type: shopType
        } as any);
      } else if (section === 'cocina') {
        await updateStoreSettings({
          kitchen_yellow_threshold: kitchenSettings.yellowThreshold,
          kitchen_red_threshold: kitchenSettings.redThreshold,
          kitchen_alert_threshold: kitchenSettings.alertThreshold,
        });
      }

      const sectionNames: Record<string, string> = {
        'empresa': 'Empresa',
        'facturas': 'Facturación',
        'pagos': 'Métodos de Pago',
        'productos': 'Productos',
        'sistema': 'Sistema',
        'impresion': 'Impresión',
        'tienda': 'Tienda',
        'cocina': 'Cocina'
      };

      let toastTitle = "Configuración guardada";
      let toastDesc = `Los cambios en ${sectionNames[section] || section} se han guardado correctamente.`;

      // Custom message for sections that save to localStorage
      if (section === 'impresion' || section === 'facturas') {
        toastTitle = "Configuración Actualizada";
        toastDesc = `La configuración de ${sectionNames[section] || section} (incluyendo tamaño de letra) se ha guardado correctamente.`;
      }

      toast({
        title: toastTitle,
        description: toastDesc,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSequence = async (id: string, newNumber: number, invoiceTypeId: string) => {
    try {
      await updateSequenceMutation.mutateAsync({ id, current_number: newNumber, invoice_type_id: invoiceTypeId });
      toast({
        title: "Secuencia actualizada",
        description: "La secuencia de facturación se ha actualizado correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la secuencia.",
        variant: "destructive",
      });
    }
  };

  const handleSavePrintSettings = async () => {
    await handleSaveSettings('impresion');
  };

  const handleTestPrint = () => {
    // Check if thermal printer should be used
    if (printSettings.useThermalPrinter && printSettings.thermalPrinterConnected) {
      handleThermalTestPrint();
      return;
    }

    // Regular browser print test
    const testInvoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prueba de Impresión</title>
          <style>
            /* Reset defaults */
            * {
              box-sizing: border-box;
            }
            
            /* Page setup */
            @page {
              margin: 0;
              size: ${printSettings.paperSize === '80mm' || printSettings.paperSize === '58mm' ? 'auto' : printSettings.paperSize === 'carta' ? 'letter' : 'auto'};
            }

            @media print {
              html, body {
                width: ${printSettings.paperSize === '80mm' ? '72mm' : printSettings.paperSize === '58mm' ? '48mm' : '100%'};
                margin: 0; /* Important for thermal */
              }
            }

            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0;
              width: ${printSettings.paperSize === '80mm' ? '72mm' :
        printSettings.paperSize === '58mm' ? '48mm' : '100%'};
              /* Add a small margin for the content itself inside the paper */
              padding: ${printSettings.paperSize === '80mm' || printSettings.paperSize === '58mm' ? '2mm' : '20px'};
              color: #000;
              background: #fff;
            }

            .test-header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 2px dashed #000;
            }

            .test-content {
              padding: 5px 0;
            }

            /* Adjust sizes for thermal printing readability */
            h1 { font-size: ${Math.round((printSettings.fontSize || 12) * 1.5)}px; margin: 0; }
            h2 { font-size: ${Math.round((printSettings.fontSize || 12) * 1.3)}px; margin: 5px 0; }
            p { font-size: ${printSettings.fontSize || 12}px; margin: 3px 0; }
            
            /* Helper classes */
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="test-header">
            <h1>PRUEBA DE IMPRESIÓN</h1>
            <p>Tamaño de papel: ${printSettings.paperSize}</p>
          </div>
          <div class="test-content">
            <h2>Información del Sistema</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Hora:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Formato:</strong> ${printSettings.paperSize}</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
            <h2>Prueba de Texto</h2>
            <p>Este es un texto de prueba para verificar la impresión.</p>
            <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p>abcdefghijklmnopqrstuvwxyz</p>
            <p>0123456789</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
            <h2>Prueba de Formato</h2>
            <p><strong>Negrita</strong> | <em>Cursiva</em> | <u>Subrayado</u></p>
            <p class="text-center">Texto Centrado</p>
            <p class="text-right">Texto Derecha</p>
            
            <div style="margin-top: 20px; text-align: center;">
              <p>*** FIN DE PRUEBA ***</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Use iframe method (more reliable, won't be blocked by popup blockers)
    const printWithIframe = () => {
      return new Promise<void>((resolve, reject) => {
        try {
          // First try window.open
          const printWindow = window.open('', '_blank', 'width=800,height=600');
          if (printWindow) {
            printWindow.document.write(testInvoiceHTML);
            printWindow.document.close();
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
                resolve();
              }, 200);
            };
            // Fallback if onload doesn't fire
            setTimeout(() => {
              printWindow.print();
              resolve();
            }, 500);
          } else {
            // Fallback to iframe if popup is blocked
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write(testInvoiceHTML);
              iframeDoc.close();

              setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  resolve();
                }, 1000);
              }, 300);
            } else {
              reject(new Error('No se pudo crear el documento de impresión'));
            }
          }
        } catch (error) {
          reject(error);
        }
      });
    };

    printWithIframe()
      .then(() => {
        toast({
          title: "Impresión enviada",
          description: `Documento de prueba enviado a la impresora (${printSettings.paperSize})`,
        });
      })
      .catch((error) => {
        console.error('Error printing:', error);
        toast({
          title: "Error de impresión",
          description: "No se pudo imprimir. Intenta de nuevo.",
          variant: "destructive",
        });
      });
  };

  // Thermal printer functions
  const handleConnectThermalPrinter = async () => {
    // La app nativa de Android usa el plugin Bluetooth nativo (ver
    // ThermalPrinterDialog.tsx / bluetoothPrinter.ts), no Web Serial API —
    // que ni siquiera existe dentro de un WebView. Ese chequeo era el bug:
    // siempre fallaba acá adentro y el diálogo nunca llegaba a abrirse.
    if (!isAndroidNative()) {
      const { thermalPrinter } = await import('@/utils/thermalPrinter');

      if (!thermalPrinter.isSupported()) {
        toast({
          title: "No soportado",
          description: "Tu navegador no soporta Web Serial API. Usa Chrome, Edge u Opera.",
          variant: "destructive",
        });
        return;
      }
    }

    setShowPrinterDialog(true);
  };

  const handlePrinterConnected = async (deviceName: string) => {
    console.log('🖨️ Conectando impresora:', deviceName);

    // Actualizar estado local
    setPrintSettings(prev => ({
      ...prev,
      thermalPrinterConnected: true,
      thermalPrinterName: deviceName,
    }));

    // Guardar en la base de datos
    try {
      console.log('💾 Guardando en base de datos...', {
        thermal_printer_name: deviceName,
        use_thermal_printer: true,
      });

      await updateStoreSettings({
        thermal_printer_name: deviceName,
        use_thermal_printer: true,
      });

      console.log('✅ Impresora guardada exitosamente en la base de datos');

      toast({
        title: "Impresora Guardada",
        description: `"${deviceName}" ha sido configurada como impresora predeterminada`,
      });
    } catch (error) {
      console.error('❌ Error saving printer:', error);
      toast({
        title: "Error al guardar",
        description: "La impresora se conectó pero no se pudo guardar la configuración",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectThermalPrinter = async () => {
    const { thermalPrinter } = await import('@/utils/thermalPrinter');
    await thermalPrinter.disconnect();

    // Actualizar estado local
    setPrintSettings(prev => ({
      ...prev,
      thermalPrinterConnected: false,
      thermalPrinterName: '',
    }));

    // Guardar en la base de datos
    try {
      await updateStoreSettings({
        thermal_printer_name: null,
        use_thermal_printer: false,
      });

      toast({
        title: "Desconectado",
        description: "Impresora térmica desconectada y configuración guardada",
      });
    } catch (error) {
      console.error('Error saving disconnection:', error);
      toast({
        title: "Desconectado",
        description: "Impresora térmica desconectada (pero hubo un error al guardar)",
        variant: "destructive",
      });
    }
  };

  const handleThermalTestPrint = async () => {
    const { handlePrint, injectPrintStyles, markContentAsPrintable } = await import('@/utils/printHandler');
    const { generateCleanInvoiceHTML } = await import('@/utils/generateCleanInvoiceHTML');
    const JsBarcode = (await import('jsbarcode')).default;

    toast({
      title: "Imprimiendo...",
      description: "Enviando factura de prueba...",
    });

    try {
      // Generate barcode if needed (only for NCF)
      let barcodeDataUrl: string | undefined;
      const isElectronic = localBillingMode === 'e-ncf';
      const showBarcode = isElectronic ? false : invoiceSettings.showBarcode;
      if (showBarcode) {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, 'B0200000001', {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 12,
            margin: 5
          });
          barcodeDataUrl = canvas.toDataURL();
        } catch (error) {
          console.error('Error generating barcode:', error);
        }
      }

      // Ensure styles are injected
      injectPrintStyles();

      // Determine format from settings
      let format: '80mm' | '58mm' | 'A4' = '80mm';
      if (printSettings.paperSize === '58mm' || printSettings.paperSize === '58mm') {
        format = '58mm';
      } else if (printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta') {
        format = 'A4';
      }

      // Generate test invoice HTML using EXACT same structure as preview
      const htmlContent = generateCleanInvoiceHTML(
        {
          name: companyInfo.name,
          logo: companyInfo.logo,
          logoSize: companyInfo.logoSize || 120,
          rnc: companyInfo.rnc,
          phone: companyInfo.phone,
          address: companyInfo.address,
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginBottom: printSettings.logoMarginBottom,
          fontSize: printSettings.fontSize, // Added font size
          paperSize: printSettings.paperSize,
        },
        {
          invoiceNumber: localBillingMode === 'e-ncf' ? 'E310000000001' : 'B0200000001',
          invoicePrefix: localBillingMode === 'e-ncf' ? 'E31' : 'B02',
          date: new Date(),
          items: [
            { name: 'Producto Ejemplo', quantity: 1, price: 100.00, total: 100.00 },
            { name: 'Servicio Ejemplo', quantity: 2, price: 75.00, total: 150.00 }
          ],
          subtotal: 250.00,
          tax: 45.00,
          taxRate: 18,
          total: 295.00,
          currency: invoiceSettings.currency || 'DOP',
          paymentTerms: invoiceSettings.paymentTerms,
          footerText: invoiceSettings.footerText,
          showBarcode: showBarcode,
          barcodeDataUrl: barcodeDataUrl,
          isElectronic: localBillingMode === 'e-ncf',
          encf: localBillingMode === 'e-ncf' ? 'E310000000001' : undefined,
          securityCode: localBillingMode === 'e-ncf' ? 'A1B2C3' : undefined,
          signatureDate: localBillingMode === 'e-ncf' ? new Date().toISOString() : undefined,
          qrCodeUrl: localBillingMode === 'e-ncf' ? 'https://dgii.gov.do/ecf/E310000000001' : undefined,
        }
      );

      // Create print container
      let printContainer = document.getElementById('temp-print-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'temp-print-container';
        document.body.appendChild(printContainer);
      }

      printContainer.innerHTML = htmlContent;
      markContentAsPrintable('temp-print-container');

      await handlePrint(format);

      // Clean up
      if (printContainer.parentNode) {
        printContainer.parentNode.removeChild(printContainer);
      }

      toast({
        title: "Impresión exitosa",
        description: "La factura de prueba ha sido enviada.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error printing test invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Error al imprimir",
        variant: "destructive",
      });
    }
  };

  // Create store function
  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un nombre para tu tienda",
        variant: "destructive",
      });
      return;
    }

    setCreatingStore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado");
      }

      const { data, error } = await supabase.rpc('create_store_for_user', {
        user_id: user.id,
        company_name: storeName.trim()
      });

      if (error) throw error;

      toast({
        title: "¡Tienda creada!",
        description: "Tu tienda ha sido configurada exitosamente",
      });

      // Refresh store data
      queryClient.invalidateQueries({ queryKey: ['user-store'] });
      setStoreName('');
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tienda",
        variant: "destructive",
      });
    } finally {
      setCreatingStore(false);
    }
  };

  const handleUpdateStoreName = async (newName: string) => {
    if (!newName.trim() || !userStore?.id) return;

    setLoading(true);
    try {
      // Create a slug from the name: "My Store" -> "my-store"
      const baseSlug = newName.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-'); // Replace spaces with hyphens

      const storeCode = userStore.store_code || '';
      // Ensure unique slug by appending store code
      const newSlug = storeCode ? `${baseSlug}-${storeCode.toLowerCase()}` : baseSlug;

      const { error } = await supabase
        .from('stores')
        .update({
          store_name: newName.trim(),
          slug: newSlug
        })
        .eq('id', userStore.id);

      if (error) throw error;

      toast({
        title: "Nombre y enlace actualizados",
        description: "El nombre de la tienda y su enlace se han actualizado correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ['user-store'] });
    } catch (error: any) {
      console.error('Error updating store:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre de la tienda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const handleExportData = async (isGlobal = false) => {
    if (!userStore?.id && !isGlobal) return;
    setLoading(true);
    try {
      // List of all functional tables in the database
      const tables = [
        'profiles', 'stores', 'categories', 'products', 'customers',
        'sales', 'sale_items', 'suppliers', 'expenses', 'payrolls',
        'payroll_items', 'invoice_sequences', 'invoice_types',
        'store_settings', 'company_settings', 'cash_sessions',
        'cash_movements', 'open_orders', 'open_order_items',
        'payment_methods_config'
      ];

      const backupData: any = {
        version: "1.1",
        timestamp: new Date().toISOString(),
        store_id: isGlobal ? 'GLOBAL' : userStore?.id,
        type: isGlobal ? 'FULL_DATABASE' : 'STORE_BACKUP',
        data: {}
      };

      for (const table of tables) {
        let query = supabase.from(table as any).select('*');

        let result;
        if (isGlobal) {
          result = await query;
        } else {
          // Try with store filter, fallback to no filter if column is missing
          result = await query.eq('store_id', userStore?.id);

          if (result.error && result.error.code === '42703') { // Column does not exist
            console.log(`Column store_id missing in ${table}, fetching without filter (RLS will still apply)`);
            result = await supabase.from(table as any).select('*');
          }
        }

        if (result.error) {
          console.warn(`Error fetching ${table}:`, result.error);
          continue;
        }
        backupData.data[table] = result.data;
      }

      const fileName = isGlobal
        ? `full-backup-${new Date().toISOString().split('T')[0]}.json`
        : `backup-${userStore?.slug || 'store'}-${new Date().toISOString().split('T')[0]}.json`;

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: isGlobal ? "Respaldo global completado" : "Respaldo completado",
        description: `El archivo ha sido descargado correctamente. (${tables.length} tablas procesadas)`,
      });
    } catch (error: any) {
      toast({
        title: "Error al exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userStore?.id) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string);

        if (!confirm("Atención: Esto reemplazará tus datos actuales. ¿Deseas continuar?")) return;

        setLoading(true);
        toast({ title: "Restaurando...", description: "Por favor espera mientras se procesan los datos." });

        const tables = [
          'payroll_items', 'payrolls', 'sale_items', 'sales',
          'expenses', 'suppliers', 'products', 'categories',
          'customers', 'invoice_sequences', 'store_settings', 'company_settings'
        ];

        // 1. Clear IndexedDB first to prevent offlineSync from uploading deleted items
        const localStores = Object.values(OfflineStore);
        for (const store of localStores) {
          await offlineDB.clear(store as OfflineStore);
        }

        // 2. Delete existing data for this store in correct order (children first)
        for (const table of tables) {
          await supabase.from(table as any).delete().eq('store_id', userStore.id);
        }

        // 2. Insert new data in correct order (parents first)
        const insertOrder = [
          'company_settings', 'store_settings', 'invoice_sequences',
          'categories', 'suppliers', 'products', 'customers',
          'sales', 'sale_items', 'payrolls', 'payroll_items', 'expenses'
        ];

        for (const table of insertOrder) {
          const rows = backupData.data[table];
          if (rows && rows.length > 0) {
            // Remove IDs to allow fresh insertion or keep them if needed? 
            // Better to keep them for relationship consistency if they are UUIDs.
            const rowsToInsert = rows.map((row: any) => ({
              ...row,
              store_id: userStore.id
            }));

            const { error } = await supabase.from(table as any).insert(rowsToInsert);
            if (error) console.error(`Error inserting into ${table}:`, error);
          }
        }

        toast({
          title: "Restauración exitosa",
          description: "Tus datos han sido restaurados correctamente. Recargando el sistema...",
        });

        // Force a complete reload to clear RAM, React Query cache, and contexts
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } catch (error: any) {
        toast({
          title: "Error al importar",
          description: "El archivo no es válido o está dañado.",
          variant: "destructive",
        });
        setLoading(false);
      } finally {
        // Reset input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetSystem = async () => {
    if (!userStore?.id) return;

    const confirmed = confirm("¿ESTÁS COMPLETAMENTE SEGURO? Esta acción borrará TODOS tus productos, ventas, clientes y gastos. No se puede deshacer.");
    if (!confirmed) return;

    const doubleConfirmed = prompt("Escribe 'BORRAR TODO' para confirmar el reseteo del sistema:");
    if (doubleConfirmed !== 'BORRAR TODO') {
      toast({ title: "Cancelado", description: "La palabra de confirmación no coincide." });
      return;
    }

    setLoading(true);
    try {
      const tables = [
        'payroll_items', 'payrolls', 'sale_items', 'sales',
        'expenses', 'suppliers', 'products', 'categories',
        'customers', 'invoice_sequences'
      ];

      // Clear local database to prevent ghostly syncs
      const localStores = Object.values(OfflineStore);
      for (const store of localStores) {
        await offlineDB.clear(store as OfflineStore);
      }

      for (const table of tables) {
        await supabase.from(table as any).delete().eq('store_id', userStore.id);
      }

      // Re-initialize default invoice sequences
      const { data: invoiceTypes } = await supabase.from('invoice_types').select('id');
      if (invoiceTypes) {
        const sequences = invoiceTypes.map(type => ({
          invoice_type_id: type.id,
          current_number: 0,
          store_id: userStore.id
        }));
        await supabase.from('invoice_sequences').insert(sequences);
      }

      toast({
        title: "Sistema reseteado",
        description: "Se han eliminado todos los datos. Reiniciando sistema...",
      });

      // Force a complete reload to clear RAM, React Query cache, and contexts
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo resetear el sistema.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mobile banners section content
  const mobileBannersSectionContent = (
    <BannerSettingsSection />
  );

  // Mobile-optimized sections content
  const mobileStoreSectionContent = (
    <div className="space-y-8">
      <SettingsStoreSection
        storeLoading={storeLoading}
        userStore={userStore}
        profile={profile}
        storeName={storeName}
        setStoreName={setStoreName}
        creatingStore={creatingStore}
        handleCreateStore={handleCreateStore}
        onUpdateStoreName={handleUpdateStoreName}
        isMobile={true}
        logoUrl={logoPreview}
        shopType={shopType}
        setShopType={setShopType}
        handleSaveSettings={handleSaveSettings}
        onSaveBusinessType={async (type) => {
          setShopType(type);
          await updateStoreSettings({ shop_type: type } as any);
        }}
      />
      <Separator />
      <BannerSettingsSection />
      <Separator />
      <StoreHoursSection />
    </div>
  );

  const mobileCompanySectionContent = (
    <div className="space-y-6">
      <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-6 text-left">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Nombre de la Empresa</Label>
            <Input id="company-name" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11" value={companyInfo.name} onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })} />
          </div>
          <div className="space-y-3">
            <Label htmlFor="company-rnc" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">RNC</Label>
            <div className="relative flex items-center">
              <Input id="company-rnc" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 pr-12 w-full" value={companyInfo.rnc} onChange={(e) => setCompanyInfo({ ...companyInfo, rnc: e.target.value })} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 w-9 h-9 text-zinc-400 hover:text-white"
                onClick={handleLookupCompanyRnc}
                disabled={isLookingUpCompanyRnc || !companyInfo.rnc}
                title="Buscar en DGII"
              >
                {isLookingUpCompanyRnc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Teléfono</Label>
            <Input id="company-phone" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11" value={companyInfo.phone} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Email</Label>
            <Input id="company-email" type="email" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11" value={companyInfo.email} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} />
          </div>
        </div>
      </div>
      <Button 
        onClick={() => handleSaveSettings('empresa')} 
        disabled={loading || isUpdating || isUploadingLogo} 
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 font-bold shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all mt-4"
      >
        <Save className="mr-2 h-4 w-4" />
        Guardar Información
      </Button>
    </div>
  );

  const mobileInvoicesSectionContent = (
    <div className="space-y-6">
      {/* --- GRUPO 1: FORMATO Y NUMERACIÓN --- */}
      <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-6 text-left">
        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 pl-1 border-l-2 border-emerald-500">
          Formato y Numeración
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-prefix" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Prefijo de Factura</Label>
            <Input id="invoice-prefix" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500/20" value={invoiceSettings.invoicePrefix} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoicePrefix: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Moneda</Label>
            <Select value={invoiceSettings.currency} onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, currency: value })}>
              <SelectTrigger className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 rounded-xl text-zinc-100">
                <SelectItem value="DOP">Peso Dominicano (DOP)</SelectItem>
                <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax-rate-mob" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Impuesto / ITBIS (%)</Label>
              <Input id="tax-rate-mob" type="number" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100" value={invoiceSettings.defaultTaxRate} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, defaultTaxRate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-terms-mob" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Términos Pago (días)</Label>
              <Input id="payment-terms-mob" type="number" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100" value={invoiceSettings.paymentTerms} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })} />
            </div>
          </div>
        </div>
        
        <Separator className="bg-zinc-800/50" />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-zinc-100 text-sm">Auto-incrementar</p>
              <p className="text-[10px] text-zinc-500">Número automático de factura</p>
            </div>
            <Switch checked={invoiceSettings.autoIncrement} onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, autoIncrement: checked })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-zinc-100 text-sm">Código NCF</p>
              <p className="text-[10px] text-zinc-500">Mostrar código barras al final</p>
            </div>
            <Switch checked={invoiceSettings.showBarcode} onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, showBarcode: checked })} />
          </div>
        </div>
      </div>

      {/* --- GRUPO 2: ASPECTO Y DISEÑO DEL RECIBO --- */}
      <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-6 text-left">
        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 pl-1 border-l-2 border-emerald-500">
          Diseño del Recibo
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Tamaño de Fuente ({printSettings.fontSize || 12}px)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={printSettings.fontSize || 12}
                onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer-text-mob" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Texto del Pie de Página</Label>
            <Textarea 
              id="footer-text-mob" 
              className="bg-zinc-950/50 border-zinc-800 rounded-xl text-zinc-100 focus:border-emerald-500" 
              value={invoiceSettings.footerText} 
              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerText: e.target.value })} 
              rows={2} 
              placeholder="Gracias por su compra..."
            />
          </div>
        </div>
      </div>

      {/* --- GRUPO 3: CONFIGURACIÓN DE CORREOS --- */}
      <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-6 text-left">
        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 pl-1 border-l-2 border-emerald-500">
          Personalización de Correos
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-greeting-mob" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Saludo del Email</Label>
            <Input id="email-greeting-mob" className="bg-zinc-950/50 border-zinc-800 rounded-xl h-11 text-zinc-100" value={invoiceSettings.emailGreeting} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailGreeting: e.target.value })} placeholder="Ej: ¡Hola!" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-message-mob" className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">Mensaje del Email</Label>
            <Textarea 
              id="email-message-mob" 
              className="bg-zinc-950/50 border-zinc-800 rounded-xl text-zinc-100 focus:border-emerald-500" 
              value={invoiceSettings.emailMessage} 
              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailMessage: e.target.value })} 
              rows={3} 
              placeholder="Escribe el mensaje que acompañará la factura adjunta..."
            />
          </div>
        </div>
      </div>

      <Button 
        onClick={() => handleSaveSettings('facturas')} 
        disabled={loading || isUpdatingStoreSettings} 
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 font-bold shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all mt-4"
      >
        <Save className="mr-2 h-4 w-4" />
        Guardar Configuración
      </Button>
    </div>
  );

  const mobilePaymentsSectionContent = (
    <div className="space-y-6">
      <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-4 text-left">
        {paymentMethods.map((method) => (
          <div key={method.id} className="flex items-center justify-between p-2">
            <div>
              <h4 className="font-bold text-zinc-100 text-sm tracking-tight capitalize">{method.name}</h4>
              <p className="text-[10px] text-zinc-500">Módulo de cobro activo</p>
            </div>
            <Switch
              checked={method.enabled}
              onCheckedChange={(checked) => {
                setPaymentMethods(prev => prev.map(m =>
                  m.id === method.id ? { ...m, enabled: checked } : m
                ));
              }}
            />
          </div>
        ))}
      </div>
      <Button 
        onClick={() => handleSaveSettings('pagos')} 
        disabled={loading || isUpdatingStoreSettings} 
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 font-bold shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all mt-4"
      >
        <Save className="mr-2 h-4 w-4" />
        Guardar Cambios
      </Button>
    </div>
  );


  const mobilePrintSectionContent = (
    <div className="space-y-6 pb-20">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="paper-size">Tamaño de Papel</Label>
          <Select
            value={printSettings.paperSize}
            onValueChange={(value) => setPrintSettings({ ...printSettings, paperSize: value })}
          >
            <SelectTrigger id="paper-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm (Térmica Estándar)</SelectItem>
              <SelectItem value="58mm">58mm (Térmica Pequeña)</SelectItem>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="carta">Carta</SelectItem>
            </SelectContent>
          </Select>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-[10px] text-blue-600 dark:text-blue-400">
              💡 <span className="font-semibold">Importante:</span> Esta configuración se aplica a "Imprimir directamente" en el POS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="page-margin" className="text-xs">Margen Página</Label>
            <Select
              value={printSettings.pageMargin}
              onValueChange={(value) => setPrintSettings({ ...printSettings, pageMargin: value })}
            >
              <SelectTrigger id="page-margin" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0mm">0mm</SelectItem>
                <SelectItem value="2mm">2mm</SelectItem>
                <SelectItem value="4mm">4mm</SelectItem>
                <SelectItem value="6mm">6mm</SelectItem>
                <SelectItem value="8mm">8mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-padding" className="text-xs">Padding Interno</Label>
            <Select
              value={printSettings.containerPadding}
              onValueChange={(value) => setPrintSettings({ ...printSettings, containerPadding: value })}
            >
              <SelectTrigger id="container-padding" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
                <SelectItem value="16px">16px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logo-margin-top" className="text-xs">Margen Logo (Superior)</Label>
            <Select
              value={printSettings.logoMarginTop || '6px'}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginTop: value })}
            >
              <SelectTrigger id="logo-margin-top" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="2px">2px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="6px">6px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-margin-bottom" className="text-xs">Margen Logo (Inferior)</Label>
            <Select
              value={printSettings.logoMarginBottom}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
            >
              <SelectTrigger id="logo-margin-bottom" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="2px">2px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="6px">6px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center">
            <Printer className="mr-2 h-4 w-4" />
            Información del Formato
          </h4>
          <div className="bg-muted p-3 rounded-lg space-y-1">
            {printSettings.paperSize === '80mm' && (
              <>
                <p className="text-[11px]"><strong>Ancho:</strong> 80mm (3.15")</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Térmica de 80mm</p>
                <p className="text-[11px]"><strong>Método:</strong> Impresión directa</p>
              </>
            )}
            {printSettings.paperSize === '58mm' && (
              <>
                <p className="text-[11px]"><strong>Ancho:</strong> 58mm (2")</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Térmica portátil</p>
                <p className="text-[11px]"><strong>Método:</strong> Impresión directa</p>
              </>
            )}
            {printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta' ? (
              <>
                <p className="text-[11px]"><strong>Documento:</strong> Formato completo</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Láser/Inyección</p>
              </>
            ) : null}
          </div>
        </div>

        <Separator />

        <h4 className="text-sm font-medium flex items-center">
          <Printer className="mr-2 h-4 w-4" />
          Impresora Térmica
        </h4>

        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Impresión Directa</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {printSettings.thermalPrinterConnected ? (
                <>
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {printSettings.thermalPrinterName}
                </>
              ) : 'No conectada'}
            </p>
          </div>
          <Switch
            checked={printSettings.useThermalPrinter}
            onCheckedChange={(checked) => setPrintSettings({ ...printSettings, useThermalPrinter: checked })}
            disabled={!printSettings.thermalPrinterConnected}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleConnectThermalPrinter}
            variant="outline"
            className="h-10 text-xs"
          >
            <Printer className="mr-2 h-4 w-4 text-primary" />
            {printSettings.thermalPrinterConnected ? 'Cambiar' : 'Conectar'}
          </Button>

          {printSettings.thermalPrinterConnected && (
            <Button
              onClick={handleDisconnectThermalPrinter}
              variant="outline"
              className="h-10 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
            >
              Desconectar
            </Button>
          )}
        </div>

        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 space-y-2">
          <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400">Consejos</h5>
          <ul className="text-[10px] space-y-1 text-muted-foreground list-disc pl-4">
            <li>Realiza una prueba antes de usar en producción</li>
            <li>Verifica si el tamaño coincide con tu impresora</li>
            <li>Para térmicas, usa papel de calidad</li>
          </ul>
        </div>

        <div className="flex gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm pt-4 pb-2">
          <Button onClick={handleSavePrintSettings} disabled={loading || isUpdatingStoreSettings} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Guardar
          </Button>
          <Button onClick={handleTestPrint} variant="outline" title="Prueba por Navegador">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Mobile Notifications Section Content
  const mobileNotificationsSectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center">
          <Volume2 className="mr-2 h-4 w-4" />
          Sonido de Pedidos Web
        </h4>

        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Sonido de Notificación</p>
            <p className="text-xs text-muted-foreground">Reproducir sonido con nuevos pedidos</p>
          </div>
          <Switch
            checked={storeSettings?.web_order_sound_enabled ?? true}
            onCheckedChange={(checked) => updateStoreSettings({ web_order_sound_enabled: checked })}
          />
        </div>

        {(storeSettings?.web_order_sound_enabled ?? true) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Sonido</Label>
              <div className="flex gap-2">
                <Select
                  value={storeSettings?.web_order_sound_type ?? 'chime'}
                  onValueChange={(value) => updateStoreSettings({ web_order_sound_type: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chime">🔔 Campanilla</SelectItem>
                    <SelectItem value="bell">🛎️ Campana</SelectItem>
                    <SelectItem value="ding">✨ Ding</SelectItem>
                    <SelectItem value="alert">⚠️ Alerta</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    import('@/utils/notificationSounds').then(({ playNotificationSound }) => {
                      playNotificationSound(
                        (storeSettings?.web_order_sound_type as any) ?? 'chime',
                        true,
                        storeSettings?.web_order_sound_volume ?? 0.7
                      );
                    });
                  }}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Volumen</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round((storeSettings?.web_order_sound_volume ?? 0.7) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={storeSettings?.web_order_sound_volume ?? 0.7}
                onChange={(e) => updateStoreSettings({ web_order_sound_volume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-medium flex items-center">
          <Bell className="mr-2 h-4 w-4" />
          Notificaciones del Sistema
        </h4>
        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Notificaciones</p>
            <p className="text-xs text-muted-foreground">Recibir alertas del sistema</p>
          </div>
          <Switch
            checked={systemSettings.notifications}
            onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, notifications: checked })}
          />
        </div>
      </div>
    </div>
  );

  const mobileSystemSectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Idioma</Label>
          <Select value={systemSettings.language} onValueChange={(value) => setSystemSettings({ ...systemSettings, language: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Zona Horaria</Label>
          <Select value={systemSettings.timezone} onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Santo_Domingo">Santo Domingo</SelectItem>
              <SelectItem value="America/New_York">New York</SelectItem>
              <SelectItem value="America/Los_Angeles">Los Angeles</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tema</Label>
          <Select value={systemSettings.theme} onValueChange={(value) => setSystemSettings({ ...systemSettings, theme: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Oscuro</SelectItem>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="auto">Automático</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <Label>Zoom / Tamaño</Label>
            <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs">A</span>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
            />
            <span className="text-lg font-bold">A</span>
          </div>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <div className="p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-900 rounded-[2rem] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-zinc-100 text-sm">Respaldo Automático</p>
              <p className="text-xs text-zinc-500">Crear respaldos de los datos</p>
            </div>
            <Switch
              checked={systemSettings.autoBackup}
              onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, autoBackup: checked })}
            />
          </div>
        </div>
        <Button 
          onClick={() => handleSaveSettings('sistema')} 
          disabled={loading || isUpdatingStoreSettings} 
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 font-bold shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all"
        >
          <Save className="mr-2 h-4 w-4" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  );

  const mobileAdvancedSectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Frecuencia de Respaldo</Label>
          <Select defaultValue="daily">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Cada Hora</SelectItem>
              <SelectItem value="daily">Diario</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="p-4 border border-destructive rounded-lg">
        <h5 className="font-medium mb-2 text-destructive">Zona de Peligro</h5>
        <p className="text-sm text-muted-foreground mb-4">
          Esto eliminará todos los datos
        </p>
        <Button variant="destructive" size="sm" className="w-full">
          Resetear Sistema
        </Button>
      </div>
    </div>
  );

  const mobileKitchenSectionContent = (
    <div className="space-y-6">
      <div className="space-y-6 bg-card border rounded-[2rem] p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Umbral Amarillo (min)</span>
              <span className="text-yellow-600 font-bold">{kitchenSettings.yellowThreshold}m</span>
            </Label>
            <Input
              type="number"
              value={kitchenSettings.yellowThreshold}
              onChange={(e) => setKitchenSettings({ ...kitchenSettings, yellowThreshold: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Umbral Rojo (min)</span>
              <span className="text-red-500 font-bold">{kitchenSettings.redThreshold}m</span>
            </Label>
            <Input
              type="number"
              value={kitchenSettings.redThreshold}
              onChange={(e) => setKitchenSettings({ ...kitchenSettings, redThreshold: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex justify-between">
              <span>Super Alerta (min)</span>
              <span className="text-red-600 font-bold animate-pulse">{kitchenSettings.alertThreshold}m</span>
            </Label>
            <Input
              type="number"
              value={kitchenSettings.alertThreshold}
              onChange={(e) => setKitchenSettings({ ...kitchenSettings, alertThreshold: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        <Button onClick={() => handleSaveSettings('cocina')} disabled={loading || isUpdatingStoreSettings} className="w-full mt-4 rounded-2xl h-12 font-bold">
          <Save className="mr-2 h-4 w-4" />
          Guardar Configuración
        </Button>
      </div>
    </div>
  );

  const handleSaveAiApiKey = async (apiKey: string | null) => {
    setSystemSettings(prev => ({ ...prev, aiApiKey: apiKey || '' }));
    await updateStoreSettings({
      ai_api_key: apiKey
    });
  };

  const mobileAiSectionContent = (
    <AiSettingsSection
      initialApiKey={storeSettings?.ai_api_key || systemSettings.aiApiKey}
      onSaveApiKey={handleSaveAiApiKey}
      isLoading={isUpdatingStoreSettings}
    />
  );

  // Loading state
  if (storeLoading || companySettingsLoading || loadingSettings || sequencesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingLogo text="Cargando configuración..." />
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-full">
        <MobileSettingsLayout
          activeSection={mobileActiveSection}
          onSectionChange={setMobileActiveSection}
          businessType={shopType === 'store' ? 'store' : shopType === 'supermarket' ? 'supermarket' : 'restaurant'}
        >
          {{
            store: mobileStoreSectionContent,
            company: mobileCompanySectionContent,
            invoices: mobileInvoicesSectionContent,
            payments: mobilePaymentsSectionContent,
            print: mobilePrintSectionContent,
            notifications: mobileNotificationsSectionContent,
            cocina: mobileKitchenSectionContent,
            ai: mobileAiSectionContent,
            system: mobileSystemSectionContent,
            advanced: mobileAdvancedSectionContent,
          }}
        </MobileSettingsLayout>
        <ThermalPrinterDialog
          open={showPrinterDialog}
          onOpenChange={setShowPrinterDialog}
          onConnect={handlePrinterConnected}
        />
      </div>
    );
  }

  // Desktop layout (existing)
  return (
    <div className="min-h-screen animate-fade-in pb-20 bg-background/50">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-12">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Configuracion
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Centro de Control del Sistema
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4">
        <Tabs defaultValue="invoices" className="flex flex-col gap-8 space-y-0">
          
          <div className="w-full pb-6 border-b border-border/40">
            <TabsList className="flex flex-wrap w-full h-auto items-center justify-center gap-2 bg-transparent p-0">
              
              <TabsTrigger value="store" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Mi Tienda</TabsTrigger>
              <TabsTrigger value="company" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Empresa</TabsTrigger>
              
              <TabsTrigger value="billing-method" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Método de Factura</TabsTrigger>
              <TabsTrigger value="invoices" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Preferencias</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Métodos de Pago</TabsTrigger>
              
              <TabsTrigger value="print" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Impresión</TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Comunicaciones</TabsTrigger>
              {(shopType === 'restaurant') && (
                <TabsTrigger value="cocina" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Cocina KDS</TabsTrigger>
              )}

              <TabsTrigger value="ai" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Inteligencia Artificial
              </TabsTrigger>
              <TabsTrigger value="system" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Apariencia</TabsTrigger>
              <TabsTrigger value="advanced" className="rounded-full px-5 py-2 text-sm font-medium transition-all text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">Avanzado</TabsTrigger>
              
            </TabsList>
          </div>

          <div className="flex-1 w-full max-w-6xl min-w-0 mx-auto">
            {/* Store Settings - Mi Tienda */}
            <TabsContent value="store" className="space-y-6 mt-0">
          {/* ── Módulos activos ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LayoutGrid className="h-5 w-5 text-primary" />
                Módulos del Sistema
              </CardTitle>
              <CardDescription>
                Activa o desactiva páginas del menú de navegación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Delivery toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Bike className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Página de Delivery</p>
                    <p className="text-xs text-muted-foreground">Muestra la página de gestión de pedidos delivery en el menú</p>
                  </div>
                </div>
                <Switch
                  checked={storeSettings?.use_delivery !== false}
                  onCheckedChange={async (checked) => {
                    await updateStoreSettings({ use_delivery: checked } as any);
                    toast({ title: checked ? '✅ Delivery activado' : '🚫 Delivery desactivado', description: checked ? 'La página de Delivery aparece en el menú' : 'La página de Delivery fue ocultada del menú' });
                  }}
                />
              </div>

              {/* Kitchen toggle — functional, only shown for restaurant type */}
              {shopType === 'restaurant' && (
                <div className={`flex items-center justify-between p-4 rounded-xl border bg-muted/30 transition-opacity ${storeSettings?.use_kitchen === false ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <ChefHat className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Pantalla de Cocina</p>
                      <p className="text-xs text-muted-foreground">
                        Activa la pantalla de cocina y el flujo de pedidos a cocina
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={storeSettings?.use_kitchen !== false}
                    onCheckedChange={async (checked) => {
                      await updateStoreSettings({ use_kitchen: checked } as any);
                      toast({ title: checked ? '✅ Cocina activada' : '🚫 Cocina desactivada', description: checked ? 'La Pantalla de Cocina aparece en el menú' : 'La Pantalla de Cocina fue ocultada del menú' });
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <SettingsStoreSection
            storeLoading={storeLoading}
            userStore={userStore}
            profile={profile}
            storeName={storeName}
            setStoreName={setStoreName}
            creatingStore={creatingStore}
            handleCreateStore={handleCreateStore}
            onUpdateStoreName={handleUpdateStoreName}
            logoUrl={logoPreview}
            shopType={shopType}
            setShopType={setShopType}
            handleSaveSettings={handleSaveSettings}
            onSaveBusinessType={async (type) => {
              setShopType(type);
              await updateStoreSettings({ shop_type: type } as any);
            }}
          />
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="mr-2 h-5 w-5" />
                Banners Promocionales
              </CardTitle>
              <CardDescription>
                Configura los banners que aparecerán en la parte superior de tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BannerSettingsSection />
            </CardContent>
          </Card>
          <StoreHoursSection />
        </TabsContent>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>
                Configura los datos de tu empresa que aparecerán en las facturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nombre de la Empresa</Label>
                  <Input
                    id="company-name"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-rnc">RNC</Label>
                  <div className="relative flex items-center">
                    <Input
                      id="company-rnc"
                      className="bg-zinc-900 border-zinc-800 text-white rounded-xl h-11 pr-12 w-full"
                      value={companyInfo.rnc}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, rnc: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 w-9 h-9 text-zinc-400 hover:text-white"
                      onClick={handleLookupCompanyRnc}
                      disabled={isLookingUpCompanyRnc || !companyInfo.rnc}
                      title="Buscar en DGII"
                    >
                      {isLookingUpCompanyRnc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Teléfono</Label>
                  <Input
                    id="company-phone"
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-website">Sitio Web</Label>
                  <Input
                    id="company-website"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-address">Dirección</Label>
                <Textarea
                  id="company-address"
                  value={companyInfo.address}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-description">Descripción de la Tienda (Acerca de nosotros)</Label>
                <Textarea
                  id="company-description"
                  value={companyInfo.metaDescription}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, metaDescription: e.target.value })}
                  rows={3}
                  placeholder="Ofrecemos productos de la más alta calidad..."
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center">
                  Redes Sociales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-facebook-desk">Facebook</Label>
                    <Input
                      id="social-facebook-desk"
                      value={companyInfo.socialFacebook}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, socialFacebook: e.target.value })}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-instagram-desk">Instagram</Label>
                    <Input
                      id="social-instagram-desk"
                      value={companyInfo.socialInstagram}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, socialInstagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-twitter-desk">Twitter / X</Label>
                    <Input
                      id="social-twitter-desk"
                      value={companyInfo.socialTwitter}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, socialTwitter: e.target.value })}
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Label>Logo de la Empresa</Label>

                {logoPreview ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center w-full max-w-xs p-4 border-2 border-dashed border-border rounded-lg bg-muted/50">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="logo-size">Tamaño en Factura (px)</Label>
                          <Input
                            id="logo-size"
                            type="number"
                            value={companyInfo.logoSize || 120}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, logoSize: parseInt(e.target.value) || 120 })}
                            min="50"
                            max="500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="logo-cart-size">Tamaño en Carrito (px)</Label>
                          <Input
                            id="logo-cart-size"
                            type="number"
                            value={companyInfo.logoCartSize || 200}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, logoCartSize: parseInt(e.target.value) || 200 })}
                            min="100"
                            max="400"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="logo-summary-size">Tamaño en Resumen (px)</Label>
                        <Input
                          id="logo-summary-size"
                          type="number"
                          value={companyInfo.logoSummarySize || 64}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, logoSummarySize: parseInt(e.target.value) || 64 })}
                          min="30"
                          max="150"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('company-logo')?.click()}
                      >
                        Cambiar Logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                      >
                        Remover Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => document.getElementById('company-logo')?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Haz clic para subir el logo
                    </p>
                  </div>
                )}

                <Input
                  id="company-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: JPG, PNG. Tamaño máximo: 2MB. Recomendado: 500px ancho (PNG).
                </p>
                {logoUploadError && (
                  <p className="text-sm text-red-500 font-medium mt-1">
                    Error: {logoUploadError}
                  </p>
                )}
              </div>
              <Button onClick={() => handleSaveSettings('empresa')} disabled={loading || isUpdating || isUploadingLogo}>
                <Save className="mr-2 h-4 w-4" />
                Guardar Información de la Empresa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Method Settings */}
        <TabsContent value="billing-method" className="space-y-6 mt-0">
          <BillingMethodSection onModeChange={setLocalBillingMode} />

            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center">
                    <Hash className="mr-2 h-5 w-5" />
                    Secuencias de Facturas
                  </CardTitle>
                  <CardDescription>
                    Configura y administra las secuencias numéricas para cada tipo de factura
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {sequencesLoading ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Cargando secuencias...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invoiceSequences
                        ?.filter(seq => ['B01', 'B02', 'B03', 'B04', 'B14', 'B15', 'B16'].includes(seq.invoice_type_id))
                        .map((sequence) => {
                          const invoiceType = invoiceTypes?.find(type => type.id === sequence.invoice_type_id);
                          const minNumber = maxInvoiceNumbers?.[sequence.invoice_type_id] || 0;
                          
                          const isElectronic = localBillingMode === 'e-ncf';
                          let displayId = sequence.invoice_type_id;
                          let displayName = invoiceType?.name;
                          let displayDescription = invoiceType?.description;
                          
                          if (isElectronic) {
                             switch (sequence.invoice_type_id) {
                                case 'B01':
                                   displayId = 'E31';
                                   displayName = 'Crédito Fiscal Electrónico';
                                   displayDescription = 'Factura con derecho a crédito fiscal (e-CF)';
                                   break;
                                case 'B02':
                                   displayId = 'E32';
                                   displayName = 'Consumidor Final Electrónico';
                                   displayDescription = 'Factura para consumidor final (e-CF)';
                                   break;
                                case 'B03':
                                   displayId = 'E33';
                                   displayName = 'Nota de Débito Electrónica';
                                   displayDescription = 'Nota de débito electrónica (e-CF)';
                                   break;
                                case 'B04':
                                   displayId = 'E34';
                                   displayName = 'Nota de Crédito Electrónica';
                                   displayDescription = 'Nota de crédito electrónica (e-CF)';
                                   break;
                                case 'B14':
                                   displayId = 'E44';
                                   displayName = 'Régimen Especial Electrónico';
                                   displayDescription = 'Comprobante para regímenes especiales (e-CF)';
                                   break;
                                case 'B15':
                                   displayId = 'E45';
                                   displayName = 'Gubernamental Electrónico';
                                   displayDescription = 'Comprobante gubernamental (e-CF)';
                                   break;
                                case 'B16':
                                   displayId = 'E46';
                                   displayName = 'Exportación Electrónica';
                                   displayDescription = 'Comprobante de exportación (e-CF)';
                                   break;
                             }
                          }

                          return (
                            <div key={sequence.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{displayId}</span>
                                  <span className="text-muted-foreground">-</span>
                                  <span className="text-sm text-muted-foreground">{displayName}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {displayDescription}
                                </p>
                                {minNumber > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Última factura usada: {minNumber}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs">Próximo Número</Label>
                                  <InvoiceSequenceInput
                                    id={sequence.id}
                                    invoiceTypeId={sequence.invoice_type_id}
                                    currentNumber={sequence.current_number}
                                    onUpdate={handleUpdateSequence}
                                    isElectronic={isElectronic}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
        </TabsContent>

        {/* Invoice Settings */}
        <TabsContent value="invoices" className="space-y-6 mt-0">
          <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Configuración de Facturas</h2>
              <p className="text-muted-foreground mt-1">Personaliza el diseño, formato y comportamiento de tus recibos impresos y digitales.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Columna Izquierda: Formulario (7 columnas) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Sección 1: Diseño Visual */}
                <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-md p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                  <h3 className="text-lg font-semibold flex items-center mb-6 text-foreground/90">
                    <div className="p-2 rounded-md bg-primary/10 mr-3">
                      <Palette className="h-4 w-4 text-primary" />
                    </div>
                    Diseño Visual
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="logo-size" className="text-sm font-medium">Tamaño del Logo (px)</Label>
                      <div className="relative">
                        <Input
                          id="logo-size"
                          type="number"
                          min="40"
                          max="500"
                          value={companyInfo.logoSize}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, logoSize: parseInt(e.target.value) || 120 })}
                          className="bg-background/50 border-border/50 focus:bg-background transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="font-size" className="text-sm font-medium">Tamaño de Fuente (px)</Label>
                      <div className="flex items-center gap-3 bg-background/50 border border-border/50 rounded-md p-1 pr-3">
                        <Input
                          id="font-size"
                          type="number"
                          min="8"
                          max="24"
                          value={printSettings.fontSize || 12}
                          onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
                          className="w-16 h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                        />
                        <input
                          type="range"
                          min="8"
                          max="24"
                          step="1"
                          value={printSettings.fontSize || 12}
                          onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
                          className="flex-1 accent-primary cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-3">
                      <Label htmlFor="logo-margin-top-invoice" className="text-sm font-medium">Margen Superior del Logo</Label>
                      <Select
                        value={printSettings.logoMarginTop || '6px'}
                        onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginTop: value })}
                      >
                        <SelectTrigger id="logo-margin-top-invoice" className="bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">Sin espacio (0px)</SelectItem>
                          <SelectItem value="2px">Muy pequeño (2px)</SelectItem>
                          <SelectItem value="4px">Pequeño (4px)</SelectItem>
                          <SelectItem value="6px">Normal (6px)</SelectItem>
                          <SelectItem value="8px">Medio (8px)</SelectItem>
                          <SelectItem value="12px">Grande (12px)</SelectItem>
                          <SelectItem value="16px">Muy grande (16px)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="logo-margin-invoice" className="text-sm font-medium">Margen Inferior del Logo</Label>
                      <Select
                        value={printSettings.logoMarginBottom || '6px'}
                        onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
                      >
                        <SelectTrigger id="logo-margin-invoice" className="bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">Sin espacio (0px)</SelectItem>
                          <SelectItem value="2px">Muy pequeño (2px)</SelectItem>
                          <SelectItem value="4px">Pequeño (4px)</SelectItem>
                          <SelectItem value="6px">Normal (6px)</SelectItem>
                          <SelectItem value="8px">Medio (8px)</SelectItem>
                          <SelectItem value="12px">Grande (12px)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border/30 flex flex-row items-center justify-between group">
                    <div className="space-y-1">
                      <Label htmlFor="logo-width" className="text-sm font-medium cursor-pointer">Ajustar al Ancho Completo</Label>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
                        Expande el logo a todo el ancho del ticket
                      </p>
                    </div>
                    <Switch
                      id="logo-width"
                      checked={printSettings.logoWidth === 'full'}
                      onCheckedChange={(checked) => setPrintSettings({ ...printSettings, logoWidth: checked ? 'full' : 'auto' })}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>

                {/* Sección 2: Datos y Finanzas */}
                <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-md p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                  <h3 className="text-lg font-semibold flex items-center mb-6 text-foreground/90">
                    <div className="p-2 rounded-md bg-primary/10 mr-3">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    Datos y Finanzas
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="currency" className="text-sm font-medium">Moneda</Label>
                      <Select value={invoiceSettings.currency} onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, currency: value })}>
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOP">DOP - Peso</SelectItem>
                          <SelectItem value="USD">USD - Dólar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="tax-rate" className="text-sm font-medium">Impuesto (%)</Label>
                      <Input
                        id="tax-rate"
                        type="number"
                        value={invoiceSettings.defaultTaxRate}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, defaultTaxRate: e.target.value })}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label htmlFor="payment-terms" className="text-sm font-medium">Términos (días)</Label>
                      <Input
                        id="payment-terms"
                        type="number"
                        value={invoiceSettings.paymentTerms}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border/30 space-y-5">
                    <div className="flex flex-row items-center justify-between group">
                      <div className="space-y-1">
                        <Label htmlFor="show-barcode" className="text-sm font-medium cursor-pointer">Mostrar Código de Barras NCF</Label>
                        <p className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">Añade el código al pie de la factura</p>
                      </div>
                      <Switch
                        id="show-barcode"
                        checked={invoiceSettings.showBarcode || false}
                        onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, showBarcode: checked })}
                      />
                    </div>
                    
                    <div className="flex flex-row items-center justify-between group">
                      <div className="space-y-1">
                        <Label htmlFor="auto-increment" className="text-sm font-medium cursor-pointer">Auto-incrementar Numeración</Label>
                        <p className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">Suma 1 automáticamente a la siguiente factura</p>
                      </div>
                      <Switch
                        id="auto-increment"
                        checked={invoiceSettings.autoIncrement}
                        onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, autoIncrement: checked })}
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Textos y Mensajes */}
                <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-md p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                  <h3 className="text-lg font-semibold flex items-center mb-6 text-foreground/90">
                    <div className="p-2 rounded-md bg-primary/10 mr-3">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    Textos y Correos
                  </h3>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <Label htmlFor="footer-text" className="text-sm font-medium">Mensaje en Pie de Página (Impreso)</Label>
                      <Textarea
                        id="footer-text"
                        value={invoiceSettings.footerText}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerText: e.target.value })}
                        rows={2}
                        className="bg-background/50 border-border/50 resize-none focus-visible:ring-primary/50"
                        placeholder="Ej: ¡Gracias por su compra! Vuelva pronto."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/30">
                      <div className="space-y-3">
                        <Label htmlFor="email-greeting" className="text-sm font-medium">Saludo del Correo</Label>
                        <Input
                          id="email-greeting"
                          placeholder="Ej: ¡Hola!"
                          value={invoiceSettings.emailGreeting}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailGreeting: e.target.value })}
                          className="bg-background/50 border-border/50"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="email-message" className="text-sm font-medium">Cuerpo del Correo</Label>
                        <Textarea
                          id="email-message"
                          placeholder="Escribe el mensaje de agradecimiento..."
                          value={invoiceSettings.emailMessage}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailMessage: e.target.value })}
                          rows={3}
                          className="bg-background/50 border-border/50 resize-none focus-visible:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón de Guardar */}
                <div className="sticky bottom-6 z-10 pt-2 pb-4">
                  <Button 
                    onClick={() => handleSaveSettings('facturas')} 
                    disabled={loading || isUpdatingStoreSettings}
                    className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] transition-all font-semibold rounded-xl"
                    size="lg"
                  >
                    <Save className="mr-2 h-5 w-5" />
                    Guardar Cambios
                  </Button>
                </div>
              </div>

              {/* Columna Derecha: Vista Previa (5 columnas) */}
              <div className="lg:col-span-5 relative">
                <div className="sticky top-6 rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-[#0a0a0a] flex flex-col h-[calc(100vh-140px)] min-h-[650px] ring-1 ring-white/10">
                  
                  {/* Header de la vista previa estilo macOS */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111]">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-[#ff5f56]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#ffbd2e]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#27c93f]"></div>
                      <span className="ml-3 text-xs font-medium text-white/50 tracking-wider">PREVIEW</span>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse"></div>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">En Vivo</span>
                    </div>
                  </div>

                  {/* Contenedor del recibo scrollable */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center custom-scrollbar relative">
                    {/* Efecto de luz radial de fondo */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                    
                    {/* El Recibo Físico */}
                    <div className="w-full max-w-[320px] bg-[#fcfcfc] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-300 relative group h-fit z-10"
                         style={{ 
                           color: '#111', 
                           fontSize: `${printSettings.fontSize || 12}px`, 
                           lineHeight: '1.4',
                         }}>
                      
                      {/* Efecto de papel rasgado superior (CSS puro) */}
                      <div className="absolute top-0 left-0 right-0 h-2 w-full bg-[radial-gradient(circle_at_10px_0,#fcfcfc_10px,transparent_11px)]" style={{ backgroundSize: '20px 10px', marginTop: '-10px', filter: 'drop-shadow(0 -1px 2px rgba(0,0,0,0.1))' }}></div>
                      
                      <div className="p-5">
                        {/* Top Badge */}
                        <div className="flex justify-center mb-2">
                          <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Recibo de Compra</span>
                        </div>

                        {/* Logo */}
                        {companyInfo.logo && (
                          <div className="text-center transition-all duration-300" style={{ marginTop: printSettings.logoMarginTop, marginBottom: printSettings.logoMarginBottom }}>
                            <img
                              src={companyInfo.logo}
                              alt="Logo"
                              className="mx-auto w-auto object-contain grayscale opacity-90 mix-blend-multiply"
                              style={{
                                maxHeight: printSettings.logoWidth === 'full' ? 'none' : `${Math.min(companyInfo.logoSize || 64, 60)}px`,
                                width: printSettings.logoWidth === 'full' ? '100%' : 'auto',
                                height: 'auto',
                                maxWidth: '80%'
                              }}
                            />
                          </div>
                        )}

                        {/* Header */}
                        <div className="text-center pb-2 mb-2">
                          <h2 className="font-black uppercase tracking-tight text-zinc-900" style={{ fontSize: '1.25em' }}>{companyInfo.name || 'Mi Negocio'}</h2>
                          {companyInfo.rnc && <p className="leading-tight text-slate-600 font-medium" style={{ fontSize: '0.85em' }}>RNC: {companyInfo.rnc}</p>}
                          {companyInfo.phone && <p className="leading-tight text-slate-600 font-medium" style={{ fontSize: '0.85em' }}>Tel: {companyInfo.phone}</p>}
                          {companyInfo.address && <p className="leading-tight text-slate-600 font-medium mt-0.5" style={{ fontSize: '0.85em' }}>{companyInfo.address}</p>}
                        </div>

                        {/* Ultra-Modern NCF Card Box */}
                        <div className="bg-white text-black rounded-md p-2 my-2 text-center border-2 border-black">
                          <p className="font-black uppercase tracking-widest text-black text-[9px]">
                            {localBillingMode === 'e-ncf' ? 'COMPROBANTE ELECTRÓNICO (e-NCF)' : 'NCF / COMPROBANTE FISCAL'}
                          </p>
                          <p className="font-mono font-black tracking-widest text-black text-base mt-0.5">
                            {localBillingMode === 'e-ncf' ? 'E310000000001' : 'B0200000001'}
                          </p>
                          <p className="text-[9px] text-black font-bold mt-0.5">📅 {new Date().toLocaleDateString('es-DO')} • {new Date().toLocaleTimeString('es-DO', {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>

                        {/* Customer Info */}
                        <div className="border-y border-dashed border-slate-300 py-1.5 my-2.5 text-[11px]">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Cliente</p>
                          <p className="font-bold text-zinc-900">CLIENTE FINAL</p>
                        </div>

                        {/* Items ejemplo */}
                        <div className="my-2.5 space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase pb-1 border-b-2 border-zinc-900 tracking-wider">
                            <span>Artículos / Cant.</span>
                            <span>Total</span>
                          </div>
                          <div className="py-1 border-b border-dotted border-slate-200 text-[11px]">
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-zinc-900">Producto Ejemplo</span>
                              <span className="font-mono font-extrabold text-zinc-900">{invoiceSettings.currency} 100.00</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-0.5">1 × {invoiceSettings.currency} 100.00</span>
                            </div>
                          </div>
                          <div className="py-1 border-b border-dotted border-slate-200 text-[11px]">
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-zinc-900">Servicio Premium</span>
                              <span className="font-mono font-extrabold text-zinc-900">{invoiceSettings.currency} 150.00</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-0.5">2 × {invoiceSettings.currency} 75.00</span>
                            </div>
                          </div>
                        </div>

                        {/* Totales */}
                        <div className="space-y-1 my-2.5 text-[11px]">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal:</span>
                            <span className="font-mono font-bold text-zinc-900">{invoiceSettings.currency} 250.00</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>ITBIS ({invoiceSettings.defaultTaxRate}%):</span>
                            <span className="font-mono font-bold text-zinc-900">{invoiceSettings.currency} {(250 * parseFloat(invoiceSettings.defaultTaxRate || '0') / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-950 text-white rounded-lg p-2.5 mt-2 font-bold shadow-md">
                            <span className="text-xs uppercase tracking-wider font-black">TOTAL</span>
                            <span className="font-mono text-base font-black">{invoiceSettings.currency} {(250 * (1 + parseFloat(invoiceSettings.defaultTaxRate || '0') / 100)).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Footer */}
                        {invoiceSettings.footerText && (
                          <div className="text-center border-t border-black/30 pt-3 mt-4" style={{ fontSize: '0.9em' }}>
                            <p className="font-medium italic">{invoiceSettings.footerText}</p>
                          </div>
                        )}

                        {/* Términos de pago */}
                        {invoiceSettings.paymentTerms && (
                          <div className="text-center pt-2 text-black/60" style={{ fontSize: '0.8em' }}>
                            <p>Términos de pago: {invoiceSettings.paymentTerms} días</p>
                          </div>
                        )}

                        {/* Código de Barras o QR */}
                        {invoiceSettings.showBarcode && (
                          <div className="text-center pt-4 mt-4 border-t-[1.5px] border-dashed border-black/40">
                            {localBillingMode === 'e-ncf' ? (
                              <div className="flex flex-col items-center justify-center">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://dgii.gov.do/ecf/E310000000001')}`} alt="Código QR Fiscal" style={{ width: '110px', height: '110px', display: 'block', margin: '0 auto' }} className="opacity-90 mix-blend-multiply" />
                                <div style={{ fontSize: '10px', textAlign: 'left', margin: '10px auto 0 auto', width: 'fit-content', fontFamily: 'monospace', lineHeight: 1.4 }}>
                                  <div><strong>Código de seguridad:</strong> A1B2C3</div>
                                  <div>
                                    <strong>Firma digital:</strong> <br/> {new Date().toLocaleDateString('es-DO')} {new Date().toLocaleTimeString('es-DO', { hour12: false })}
                                  </div>
                                </div>
                                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#111', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }} className="border border-black/20 px-2 py-1 rounded-sm bg-black/5">
                                  Comprobante Autorizado por la DGII
                                </div>
                              </div>
                            ) : (
                              <div className="bg-transparent inline-block">
                                <svg width="240" height="75" className="mx-auto opacity-90">
                                  {/* Simulación de código de barras */}
                                  {[...Array(26)].map((_, i) => (
                                    <rect
                                      key={i}
                                      x={5 + i * 9}
                                      y="0"
                                      width={Math.random() > 0.5 ? 4 : (Math.random() > 0.5 ? 2.5 : 4.5)}
                                      height="55"
                                      fill="black"
                                    />
                                  ))}
                                  <text x="120" y="70" fontSize="13" fontWeight="900" fontFamily="monospace" textAnchor="middle" fill="black">B0200000001</text>
                                </svg>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Marca de Agua CobroApp en grande */}
                        <div className="flex items-center justify-center gap-2 mt-5 pt-3 border-t border-dashed border-slate-300">
                          <img
                            src={`${window.location.origin}/cobro-logo.png`}
                            alt="CobroApp"
                            style={{ height: '20px', width: 'auto' }}
                            className="inline-block"
                          />
                          <span className="text-base font-black text-zinc-950 uppercase tracking-widest">
                            COBROAPP
                          </span>
                        </div>
                      </div>
                      
                      {/* Efecto de papel rasgado inferior (CSS puro) */}
                      <div className="absolute bottom-0 left-0 right-0 h-2 w-full bg-[radial-gradient(circle_at_10px_10px,#fcfcfc_10px,transparent_11px)]" style={{ backgroundSize: '20px 10px', marginBottom: '-10px', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Métodos de Pago
              </CardTitle>
              <CardDescription>
                Configura los métodos de pago disponibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex flex-col gap-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{method.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Método de pago {method.name.toLowerCase()}
                        </p>
                      </div>
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={(checked) => {
                          setPaymentMethods(prev => prev.map(m =>
                            m.id === method.id ? { ...m, enabled: checked } : m
                          ));
                        }}
                      />
                    </div>
                    {method.id === 'card' && method.enabled && (
                      <div className="flex items-center gap-4 pl-4 border-l-2 border-primary/20">
                        <Label htmlFor={`surcharge-${method.id}`} className="min-w-fit">
                          Recargo por uso (%):
                        </Label>
                        <Input
                          id={`surcharge-${method.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-24"
                          value={method.surcharge_percentage || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPaymentMethods(prev => prev.map(m =>
                              m.id === method.id ? { ...m, surcharge_percentage: val } : m
                            ));
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          Se aplicará al total de la factura
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={() => handleSaveSettings('pagos')} disabled={loading || isUpdatingStoreSettings}>
                <Save className="mr-2 h-4 w-4" />
                Guardar Métodos de Pago
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print Settings */}
        <TabsContent value="print" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Printer className="mr-2 h-5 w-5" />
                Configuración de Impresión
              </CardTitle>
              <CardDescription>
                Configura el tamaño de papel para tus facturas y realiza pruebas de impresión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paper-size">Tamaño de Papel</Label>
                  <Select
                    value={printSettings.paperSize}
                    onValueChange={(value) => setPrintSettings({ ...printSettings, paperSize: value })}
                  >
                    <SelectTrigger id="paper-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm (Impresora Térmica Estándar)</SelectItem>
                      <SelectItem value="58mm">58mm (Impresora Térmica Pequeña)</SelectItem>
                      <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem value="carta">Carta (8.5 x 11 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Thermal Printer Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="font-medium flex items-center">
                        <Printer className="mr-2 h-4 w-4" />
                        Impresora Térmica (Impresión Directa)
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Conecta una impresora térmica ESC/POS para impresión sin diálogos
                      </p>
                    </div>
                    <Switch
                      checked={printSettings.useThermalPrinter}
                      onCheckedChange={(checked) => {
                        setPrintSettings({ ...printSettings, useThermalPrinter: checked });
                      }}
                      disabled={!printSettings.thermalPrinterConnected}
                    />
                  </div>

                  {printSettings.thermalPrinterConnected ? (
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="font-medium text-green-900 dark:text-green-100">
                            Conectada: {printSettings.thermalPrinterName}
                          </span>
                        </div>
                        <Button
                          onClick={handleDisconnectThermalPrinter}
                          variant="outline"
                          size="sm"
                          className="border-green-300 dark:border-green-700"
                        >
                          Desconectar
                        </Button>
                      </div>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Las facturas se imprimirán directamente sin diálogos del navegador
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <p className="text-sm">
                          <strong>Requisitos para impresión térmica directa:</strong>
                        </p>
                        {isAndroidNative() ? (
                          <ul className="text-sm space-y-1 list-disc list-inside">
                            <li className="font-semibold">Impresora térmica ESC/POS de recibos (58mm o 80mm)</li>
                            <li>Emparejada por Bluetooth en Ajustes de Android (antes de conectar acá)</li>
                            <li>Impresora encendida y a la vista</li>
                          </ul>
                        ) : (
                          <ul className="text-sm space-y-1 list-disc list-inside">
                            <li className="font-semibold">Impresora térmica ESC/POS de recibos (58mm o 80mm)</li>
                            <li>Cable USB físico (NO Bluetooth, NO WiFi)</li>
                            <li>Impresora encendida antes de conectar</li>
                            <li>Navegador Chrome, Edge u Opera</li>
                            <li>HTTPS o localhost para pruebas</li>
                          </ul>
                        )}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mt-2">
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            ℹ️ <span className="font-semibold">Tipos de impresoras:</span>
                          </p>
                          <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1 list-disc list-inside ml-2">
                            <li><strong>Impresoras térmicas ESC/POS:</strong> Impresoras pequeñas de recibos/tickets (compatibles con esta función)</li>
                            <li><strong>Impresoras normales (láser, inkjet, PostScript):</strong> Usa "Imprimir directamente" en el POS en su lugar</li>
                          </ul>
                        </div>
                        {!isAndroidNative() && (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 mt-2">
                            <p className="text-xs text-yellow-600 dark:text-yellow-500">
                              ⚠️ <span className="font-semibold">Si ves puertos Bluetooth:</span> Significa que no hay impresoras térmicas USB conectadas. Las impresoras normales (láser, inkjet) NO aparecerán aquí.
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          💡 Marcas de impresoras térmicas compatibles: Epson TM-series, Star TSP, Citizen CT-S, Bixolon SRP, Rongta, Xprinter.
                        </p>
                      </div>
                      <Button
                        onClick={handleConnectThermalPrinter}
                        variant="default"
                        className="w-full"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Conectar Impresora Térmica
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button onClick={handleSavePrintSettings} disabled={loading || isUpdatingStoreSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Configuración
                  </Button>
                  <Button onClick={handleTestPrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Realizar Prueba de Impresión
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                    <Bell className="mr-2 h-4 w-4" />
                    Consejos para la Impresión
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Realiza una prueba de impresión antes de usar en producción</li>
                    <li>Verifica que el tamaño de papel coincida con tu impresora</li>
                    <li>Para impresoras térmicas, usa papel térmico de calidad</li>
                    <li>Configura tu navegador para imprimir sin encabezados ni pies de página</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configura las alertas y sonidos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Web Order Sound Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Volume2 className="mr-2 h-4 w-4" />
                  Sonido de Pedidos Web
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sonido de Notificación</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproducir sonido cuando llegue un nuevo pedido web
                    </p>
                  </div>
                  <Switch
                    checked={storeSettings?.web_order_sound_enabled ?? true}
                    onCheckedChange={(checked) => updateStoreSettings({ web_order_sound_enabled: checked })}
                  />
                </div>

                {(storeSettings?.web_order_sound_enabled ?? true) && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Tipo de Sonido</Label>
                      <div className="flex gap-2">
                        <Select
                          value={storeSettings?.web_order_sound_type ?? 'chime'}
                          onValueChange={(value) => updateStoreSettings({ web_order_sound_type: value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chime">🔔 Campanilla</SelectItem>
                            <SelectItem value="bell">🛎️ Campana</SelectItem>
                            <SelectItem value="ding">✨ Ding</SelectItem>
                            <SelectItem value="alert">⚠️ Alerta</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            import('@/utils/notificationSounds').then(({ playNotificationSound }) => {
                              playNotificationSound(
                                (storeSettings?.web_order_sound_type as any) ?? 'chime',
                                true,
                                storeSettings?.web_order_sound_volume ?? 0.7
                              );
                            });
                          }}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Volumen</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((storeSettings?.web_order_sound_volume ?? 0.7) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={storeSettings?.web_order_sound_volume ?? 0.7}
                        onChange={(e) => updateStoreSettings({ web_order_sound_volume: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ajusta el volumen del sonido de notificación
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* System Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  Notificaciones del Sistema
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibir notificaciones del sistema
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.notifications}
                    onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, notifications: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* Email Reports Section */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  Informes por Correo
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar Informes por Correo</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe informes automáticos con resumen de ventas, inventario bajo y pedidos pendientes
                    </p>
                  </div>
                  <Switch
                    checked={storeSettings?.email_reports_enabled ?? false}
                    onCheckedChange={(checked) => updateStoreSettings({ email_reports_enabled: checked })}
                  />
                </div>

                {(storeSettings?.email_reports_enabled ?? false) && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-4">
                      {(() => {
                        const emails = (storeSettings?.email_reports_recipient || '').split(',').map(e => e.trim());
                        const email1 = emails[0] || '';
                        const email2 = emails[1] || '';
                        const email3 = emails[2] || '';
                        
                        const handleEmailChange = (index: number, val: string) => {
                          const newEmails = [email1, email2, email3];
                          newEmails[index] = val;
                          const filtered = newEmails.map(e => e.trim()).filter(Boolean);
                          updateStoreSettings({ email_reports_recipient: filtered.join(', ') });
                        };

                        return (
                          <div className="space-y-3.5">
                            <div className="space-y-1.5">
                              <Label htmlFor="email-recipient-1">Correo de destino principal</Label>
                              <Input
                                id="email-recipient-1"
                                type="email"
                                placeholder="principal@email.com"
                                value={email1}
                                onChange={(e) => handleEmailChange(0, e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="email-recipient-2">Segundo correo (Opcional)</Label>
                              <Input
                                id="email-recipient-2"
                                type="email"
                                placeholder="adicional1@email.com"
                                value={email2}
                                onChange={(e) => handleEmailChange(1, e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="email-recipient-3">Tercer correo (Opcional)</Label>
                              <Input
                                id="email-recipient-3"
                                type="email"
                                placeholder="adicional2@email.com"
                                value={email3}
                                onChange={(e) => handleEmailChange(2, e.target.value)}
                              />
                            </div>
                          </div>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground">
                        Los informes se enviarán a estos correos configurados.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Frecuencia de Informes</Label>
                      <Select
                        value={storeSettings?.email_reports_frequency ?? 'daily'}
                        onValueChange={(value) => updateStoreSettings({ email_reports_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">📅 Diario</SelectItem>
                          <SelectItem value="weekly">📆 Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {storeSettings?.email_reports_frequency === 'weekly'
                          ? 'Recibirás un informe cada semana con el resumen de los últimos 7 días'
                          : 'Recibirás un informe cada día con el resumen del día anterior'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={!storeSettings?.email_reports_recipient || isUpdatingStoreSettings}
                        onClick={async () => {
                          if (!storeSettings?.email_reports_recipient || !userStore?.id) {
                            toast({
                              title: "Error",
                              description: "Ingresa un correo de destino válido",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            const { error } = await supabase.functions.invoke('send-daily-report', {
                              body: {
                                store_id: userStore.id,
                                recipient_email: storeSettings.email_reports_recipient,
                                report_type: storeSettings.email_reports_frequency || 'daily'
                              }
                            });
                            if (error) throw error;
                            toast({
                              title: "Informe enviado",
                              description: `Se ha enviado el informe a ${storeSettings.email_reports_recipient}`,
                            });
                          } catch (err: any) {
                            console.error('Error sending report:', err);
                            toast({
                              title: "Error",
                              description: err.message || "No se pudo enviar el informe",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Informe de Prueba
                      </Button>
                    </div>

                    {storeSettings?.email_reports_last_sent && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Último informe enviado: {new Date(storeSettings.email_reports_last_sent).toLocaleString('es-DO')}
                      </div>
                    )}
                  </div>
                )}

                <Separator className="my-6" />

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base text-primary">Notificaciones de Suscripción</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe alertas cuando se reporte un pago de plan.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription-email">Email de Notificación de Pagos</Label>
                  <Input
                    id="subscription-email"
                    type="email"
                    placeholder="Haroldrospa@gmail.com"
                    value={storeSettings?.subscription_notification_email || ''}
                    onChange={(e) => updateStoreSettings({ subscription_notification_email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este correo recibirá las notificaciones de nuevos pagos pendientes para revisión.
                  </p>
                </div>

                <Separator className="my-6" />

                {/* Evolution API Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center">
                    <span className="mr-2 text-emerald-500">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    </span>
                    WhatsApp Automático (Evolution API)
                  </h4>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Habilitar Envío Automático</Label>
                      <p className="text-sm text-muted-foreground">
                        Envía los mensajes de WhatsApp directamente sin abrir nuevas pestañas.
                      </p>
                    </div>
                    <Switch
                      checked={storeSettings?.evolution_enabled ?? false}
                      onCheckedChange={(checked) => updateStoreSettings({ evolution_enabled: checked })}
                    />
                  </div>

                  {(storeSettings?.evolution_enabled ?? false) && (
                    <div className="space-y-4 pl-4 border-l-2 border-emerald-500/20">
                      <div className="space-y-2">
                        <Label>URL de Evolution API</Label>
                        <Input
                          placeholder="ej: https://api.mi-evolution.com"
                          value={storeSettings?.evolution_api_url || ''}
                          onChange={(e) => updateStoreSettings({ evolution_api_url: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Nombre de la Instancia</Label>
                        <Input
                          placeholder="ej: CobroApp"
                          value={storeSettings?.evolution_instance_name || ''}
                          onChange={(e) => updateStoreSettings({ evolution_instance_name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Global API Key</Label>
                        <Input
                          type="password"
                          placeholder="Tu API Key"
                          value={storeSettings?.evolution_api_key || ''}
                          onChange={(e) => updateStoreSettings({ evolution_api_key: e.target.value })}
                        />
                      </div>

                      {storeSettings?.evolution_api_url && storeSettings?.evolution_instance_name && storeSettings?.evolution_api_key && (
                        <div className="pt-2">
                          <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            onClick={() => setIsQRDialogOpen(true)}
                          >
                            <QrCode className="w-4 h-4 mr-2" />
                            Escanear QR / Conectar WhatsApp
                          </Button>
                          <p className="text-[10px] text-zinc-500 text-center mt-2">
                            Asegúrate de guardar los cambios antes de escanear el código QR.
                          </p>

                          {/* Sección de prueba */}
                          <div className="mt-6 p-4 border border-zinc-800 rounded-lg bg-zinc-900/50 space-y-3">
                            <Label className="text-sm font-medium text-zinc-300">Prueba de Envío (WhatsApp)</Label>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Ej: 18091234567" 
                                value={testWhatsAppPhone}
                                onChange={(e) => setTestWhatsAppPhone(e.target.value)}
                                className="flex-1"
                              />
                              <Button 
                                onClick={async () => {
                                  try {
                                    toast({ title: 'Ejecutando diagnóstico...', description: 'Verificando estado de la instancia y número.' });
                                    
                                    let baseUrl = storeSettings.evolution_api_url!.endsWith('/') 
                                      ? storeSettings.evolution_api_url!.slice(0, -1) 
                                      : storeSettings.evolution_api_url!;
                                      
                                    if (!/^https?:\/\//i.test(baseUrl)) {
                                      baseUrl = `https://${baseUrl}`;
                                    }
                                      
                                    // 1. Connection State
                                    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${storeSettings.evolution_instance_name}`, {
                                      headers: { 'apikey': storeSettings.evolution_api_key! }
                                    });
                                    const stateData = await stateRes.json();
                                    console.log('Connection State:', stateData);
                                    
                                    // 2. Check Number
                                    const numRes = await fetch(`${baseUrl}/chat/whatsappNumbers/${storeSettings.evolution_instance_name}`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', 'apikey': storeSettings.evolution_api_key! },
                                      body: JSON.stringify({ numbers: [`1${testWhatsAppPhone.replace(/\D/g, '')}`] })
                                    });
                                    const numData = await numRes.json();
                                    console.log('WhatsApp Number Check:', numData);
                                    
                                    let diagnosis = `Estado: ${stateData?.instance?.state || stateData?.state || 'Desconocido'}. `;
                                    if (Array.isArray(numData) && numData.length > 0) {
                                      diagnosis += numData[0].exists ? 'El número SI existe en WhatsApp.' : 'El número NO existe en WhatsApp.';
                                    } else {
                                      diagnosis += 'No se pudo verificar el número.';
                                    }
                                    
                                    toast({ title: 'Diagnóstico Completado', description: diagnosis });
                                    
                                  } catch (error: any) {
                                    console.error('Error en diagnóstico:', error);
                                    toast({ title: 'Error de Diagnóstico', description: error.message, variant: 'destructive' });
                                  }
                                }}
                                disabled={!testWhatsAppPhone}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Diagnosticar
                              </Button>
                              <Button
                                disabled={!testWhatsAppPhone || isTestingWhatsApp}
                                onClick={async () => {
                                  setIsTestingWhatsApp(true);
                                  toast({ title: 'Probando...', description: 'Enviando mensaje de prueba...' });
                                  try {
                                    try {
                                      // Send format 1: Just the number with 1
                                      await sendEvolutionWhatsAppMessage(
                                        testWhatsAppPhone, 
                                        'Prueba Formato 1 (Con 1): Si recibes esto, Evolution API usa este formato. 🎉', 
                                        {
                                          url: storeSettings.evolution_api_url!,
                                          instanceName: storeSettings.evolution_instance_name!,
                                          apiKey: storeSettings.evolution_api_key!
                                        },
                                        'format1'
                                      );
                                    } catch (e) { console.error(e) }

                                  try {
                                    // Send format 2: The number with 1 and @s.whatsapp.net
                                    await sendEvolutionWhatsAppMessage(
                                      testWhatsAppPhone, 
                                      'Prueba Formato 2 (Con @s.whatsapp.net): Si recibes esto, Evolution API necesita el sufijo. 🎉', 
                                      {
                                        url: storeSettings.evolution_api_url!,
                                        instanceName: storeSettings.evolution_instance_name!,
                                        apiKey: storeSettings.evolution_api_key!
                                      },
                                      'format2'
                                    );
                                  } catch (e) { console.error(e) }

                                  try {
                                    // Send format 3: The number WITHOUT 1
                                    await sendEvolutionWhatsAppMessage(
                                      testWhatsAppPhone, 
                                      'Prueba Formato 3 (Sin 1): Si recibes esto, Evolution API usa formato local. 🎉', 
                                      {
                                        url: storeSettings.evolution_api_url!,
                                        instanceName: storeSettings.evolution_instance_name!,
                                        apiKey: storeSettings.evolution_api_key!
                                      },
                                      'format3'
                                    );
                                  } catch (e) { console.error(e) }

                                  toast({ title: '¡Éxito!', description: 'Se enviaron 3 formatos de prueba. Verifica cuál llegó a WhatsApp.', variant: 'default' });
                                } catch (err: any) {
                                  toast({ title: 'Error en la prueba', description: err.message, variant: 'destructive' });
                                } finally {
                                  setIsTestingWhatsApp(false);
                                }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                {isTestingWhatsApp ? 'Enviando...' : 'Probar'}
                              </Button>
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              Ingresa tu número de teléfono para enviar un mensaje de prueba y verificar que la conexión funciona.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kitchen Settings — only shown for restaurant type */}
        {(() => {
          const raw = shopType;
          const normalizedType = raw === 'store' ? 'store' : raw === 'supermarket' ? 'supermarket' : 'restaurant';
          if (normalizedType !== 'restaurant') return null;

          return (
            <TabsContent value="cocina" className="space-y-6 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ChefHat className="mr-2 h-5 w-5" />
                    Configuración de Cocina (KDS)
                  </CardTitle>
                  <CardDescription>
                    Configura los umbrales de tiempo para las alertas visuales y sonoras en la pantalla de cocina.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4 p-4 border rounded-2xl bg-yellow-500/5 border-yellow-500/20">
                      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-bold">
                        <Timer className="h-4 w-4" />
                        Umbral Amarillo
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kitchen-yellow">Tiempo de espera (minutos)</Label>
                        <Input
                          id="kitchen-yellow"
                          type="number"
                          value={kitchenSettings.yellowThreshold}
                          onChange={(e) => setKitchenSettings({ ...kitchenSettings, yellowThreshold: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">La orden cambiará a amarillo después de este tiempo.</p>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 border rounded-2xl bg-red-500/5 border-red-500/20">
                      <div className="flex items-center gap-2 text-red-500 font-bold">
                        <Timer className="h-4 w-4" />
                        Umbral Rojo
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kitchen-red">Tiempo de espera (minutos)</Label>
                        <Input
                          id="kitchen-red"
                          type="number"
                          value={kitchenSettings.redThreshold}
                          onChange={(e) => setKitchenSettings({ ...kitchenSettings, redThreshold: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">La orden cambiará a rojo después de este tiempo.</p>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 border rounded-2xl bg-red-600/10 border-red-600/30">
                      <div className="flex items-center gap-2 text-red-600 font-bold animate-pulse">
                        <Timer className="h-4 w-4" />
                        Super Alerta
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="kitchen-alert">Tiempo de espera (minutos)</Label>
                        <Input
                          id="kitchen-alert"
                          type="number"
                          value={kitchenSettings.alertThreshold}
                          onChange={(e) => setKitchenSettings({ ...kitchenSettings, alertThreshold: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">Parpadeo visual y alerta sonora crítica.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-[1.5rem] border space-y-2">
                    <h4 className="font-bold flex items-center gap-2 uppercase text-xs tracking-widest text-muted-foreground">
                      <Volume2 className="h-4 w-4" /> Alertas Sonoras
                    </h4>
                    <p className="text-sm">
                      KDS reproducirá un sonido "Campana" cada 30 segundos si hay órdenes en estado de <strong>Super Alerta</strong>.
                    </p>
                  </div>

                  <Button onClick={() => handleSaveSettings('cocina')} disabled={loading || isUpdatingStoreSettings} className="h-12 px-8 rounded-2xl font-bold">
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Configuración de Cocina
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })()}

        {/* AI & Vision Settings */}
        <TabsContent value="ai" className="space-y-6 mt-0">
          <AiSettingsSection
            initialApiKey={storeSettings?.ai_api_key || systemSettings.aiApiKey}
            onSaveApiKey={handleSaveAiApiKey}
            isLoading={isUpdatingStoreSettings}
          />
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6 mt-0">
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="mr-2 h-5 w-5" />
                  Configuración General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={systemSettings.language} onValueChange={(value) => setSystemSettings({ ...systemSettings, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zona Horaria</Label>
                    <Select value={systemSettings.timezone} onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Santo_Domingo">Santo Domingo</SelectItem>
                        <SelectItem value="America/New_York">New York</SelectItem>
                        <SelectItem value="America/Los_Angeles">Los Angeles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={() => handleSaveSettings('sistema')} disabled={loading || isUpdatingStoreSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración del Sistema
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="mr-2 h-5 w-5" />
                  Apariencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select
                    value={theme === 'system' ? 'auto' : theme}
                    onValueChange={(value) => {
                      const newTheme = value === 'auto' ? 'system' : value as "light" | "dark";
                      setTheme(newTheme);
                      setSystemSettings({ ...systemSettings, theme: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="auto">Automático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-2 pb-2">
                  <div className="flex items-center justify-between">
                    <Label>Zoom / Tamaño del Sistema</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs">A</span>
                    <input
                      type="range"
                      min="0.7"
                      max="1.3"
                      step="0.05"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-lg font-bold">A</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ajusta el tamaño general de la interfaz para mayor comodidad.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Columnas de Productos (Tablet/Móvil)</Label>
                  <Select
                    value={systemSettings.posLayoutGridCols}
                    onValueChange={(value) => setSystemSettings({ ...systemSettings, posLayoutGridCols: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Columna (Lista)</SelectItem>
                      <SelectItem value="2">2 Columnas (Estándar)</SelectItem>
                      <SelectItem value="3">3 Columnas (Tablet)</SelectItem>
                      <SelectItem value="4">4 Columnas (Tablet Grande)</SelectItem>
                      <SelectItem value="5">5 Columnas</SelectItem>
                      <SelectItem value="6">6 Columnas</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Ajusta el tamaño de la cuadrícula de productos en dispositivos móviles y tablets.
                  </p>
                </div>
              </CardContent>
            </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6 mt-0">
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Gestión de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-24 flex-col" onClick={() => handleExportData(false)} disabled={loading}>
                    <Download className="mb-2 h-6 w-6" />
                    Exportar Mis Datos
                    <span className="text-xs text-muted-foreground">Backup de esta tienda</span>
                  </Button>

                  {profile?.role === 'admin' && (
                    <Button variant="outline" className="h-24 flex-col border-blue-500/50 hover:bg-blue-500/10" onClick={() => handleExportData(true)} disabled={loading}>
                      <Shield className="mb-2 h-6 w-6 text-blue-500" />
                      Backup Total (Admin)
                      <span className="text-xs text-muted-foreground">Toda la base de datos</span>
                    </Button>
                  )}

                  <div className="relative">
                    <Button variant="outline" className="h-24 flex-col w-full" onClick={() => document.getElementById('import-backup')?.click()} disabled={loading}>
                      <Upload className="mb-2 h-6 w-6" />
                      Importar Datos
                      <span className="text-xs text-muted-foreground">Restaurar desde backup</span>
                    </Button>
                    <input
                      id="import-backup"
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-destructive">Zona de Peligro</h4>
                  <div className="p-4 border border-destructive rounded-lg">
                    <h5 className="font-medium mb-2">Resetear Sistema</h5>
                    <p className="text-sm text-muted-foreground mb-4">
                      Esta acción eliminará todos los datos del sistema y no se puede deshacer.
                    </p>
                    <Button variant="destructive" size="sm" onClick={handleResetSystem} disabled={loading}>
                      Resetear Sistema
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Seguridad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Frecuencia de Respaldo</Label>
                  <Select
                    value={systemSettings.backupFrequency}
                    onValueChange={(value) => setSystemSettings({ ...systemSettings, backupFrequency: value })}
                  >
                    <SelectTrigger id="backup-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Cada Hora</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Días de Retención de Logs</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    value={systemSettings.retentionDays}
                    onChange={(e) => setSystemSettings({ ...systemSettings, retentionDays: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between border border-emerald-500/20 p-4 rounded-lg bg-emerald-500/5">
                  <div className="space-y-0.5">
                    <Label>Respaldo Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Crear respaldos automáticos de los datos
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.autoBackup}
                    onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, autoBackup: checked })}
                  />
                </div>

                <Button onClick={() => handleSaveSettings('sistema')} disabled={loading || isUpdatingStoreSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración de Seguridad
                </Button>
              </CardContent>
            </Card>
        </TabsContent>
          </div>
        </Tabs>
      </div>

      <ThermalPrinterDialog
        open={showPrinterDialog}
        onOpenChange={setShowPrinterDialog}
        onConnect={handlePrinterConnected}
      />
      {storeSettings && (
        <EvolutionQRDialog
          isOpen={isQRDialogOpen}
          onClose={() => setIsQRDialogOpen(false)}
          apiUrl={storeSettings.evolution_api_url || ''}
          apiKey={storeSettings.evolution_api_key || ''}
          instanceName={storeSettings.evolution_instance_name || ''}
        />
      )}
    </div>
  );
};

export default Settings;