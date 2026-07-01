import { useStoreSettings } from './useStoreSettings';
import { useCompanySettings } from './useCompanySettings';
import { useUserStore } from './useUserStore';

export type PaperSize = '58mm' | '80mm' | 'A4' | 'carta';

export interface PrintSettings {
  paperSize: PaperSize;
  useThermalPrinter: boolean;
  thermalPrinterName: string;
  pageMargin?: string;
  containerPadding?: string;
  logoMarginTop?: string;
  logoMarginBottom?: string;
  showBarcode?: boolean; // NEW: Barcode visibility
  logoWidth?: 'auto' | 'full'; // NEW: Logo width control
  fontSize?: number; // NEW: Font size control
}

export interface CompanyInfoForPrint {
  name: string;
  rnc: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logo: string;
  slogan: string;
  logoCartSize: number;
  logoSummarySize: number;
  logoInvoiceSize: number;
}

export const usePrintSettings = () => {
  const { settings: storeSettings, loadingSettings: isLoadingStore } = useStoreSettings();
  const { settings: companySettings, isLoading: isLoadingCompany } = useCompanySettings();
  const { data: userStore } = useUserStore();

  // Load visual settings from LocalStorage (since DB schema might lack these columns)
  const localMargins = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('print_margins_settings') || '{}')
    : {};

  // Load local invoice settings (for barcode)
  const localInvoiceSettings = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('invoice_settings_local') || '{}')
    : {};

  const printSettings: PrintSettings = {
    paperSize: (storeSettings?.paper_size as PaperSize) || '80mm',
    useThermalPrinter: storeSettings?.use_thermal_printer || false,
    thermalPrinterName: storeSettings?.thermal_printer_name || '',
    // Prioritize LocalStorage -> DB (if exists, cast as any to avoid TS error) -> Default
    pageMargin: localMargins.pageMargin || (storeSettings as any)?.page_margin || '0mm',
    containerPadding: localMargins.containerPadding || (storeSettings as any)?.container_padding || '4px',
    logoMarginTop: localMargins.logoMarginTop || (storeSettings as any)?.logo_margin_top || '6px',
    logoMarginBottom: localMargins.logoMarginBottom || (storeSettings as any)?.logo_margin_bottom || '6px',
    // Check local storage -> DB -> default false
    showBarcode: localInvoiceSettings.showBarcode ?? storeSettings?.show_barcode ?? false,
    logoWidth: localMargins.logoWidth || 'auto',
    fontSize: parseInt(localMargins.fontSize) || 12,
  };

  const companyInfo: CompanyInfoForPrint = {
    name: companySettings?.company_name || userStore?.store_name || 'Mi Empresa',
    rnc: companySettings?.rnc || '',
    phone: companySettings?.phone || '',
    email: companySettings?.email || '',
    address: companySettings?.address || '',
    website: companySettings?.website || '',
    logo: companySettings?.logo_url || '',
    slogan: companySettings?.slogan || '',
    logoCartSize: companySettings?.logo_cart_size || 200,
    logoSummarySize: companySettings?.logo_summary_size || 64,
    logoInvoiceSize: companySettings?.logo_invoice_size || 120,
  };

  return {
    printSettings,
    companyInfo,
    isLoading: isLoadingStore || isLoadingCompany,
  };
};
