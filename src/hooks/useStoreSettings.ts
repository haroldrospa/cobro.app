import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';

export type PaymentMethod = {
  id: string;
  name: string;
  enabled: boolean;
  surcharge_percentage?: number;
}

export type StoreSettings = {
  // Invoice Settings
  invoice_prefix: string;
  auto_increment: boolean;
  show_tax: boolean;
  default_tax_rate: number;
  currency: string;
  payment_terms: number;
  invoice_footer_text: string;
  email_greeting?: string;
  email_message?: string;

  // POS / Payments
  payment_methods: PaymentMethod[];

  // Products / Inventory
  low_stock_alert: boolean;
  low_stock_threshold: number;

  // System
  notifications_enabled: boolean;
  auto_backup: boolean;
  theme: string;
  language: string;
  timezone: string;

  // Printing
  paper_size: string;
  use_thermal_printer: boolean;
  thermal_printer_name: string | null;
  show_barcode?: boolean; // NEW: Show barcode on invoice
  logo_margin_top?: string;
  logo_margin_bottom?: string;
  logo_width?: string;
  invoice_font_size?: number; // Tamaño de fuente para la factura

  // Web Orders
  web_order_sound_enabled: boolean;
  web_order_sound_type: string;
  web_order_sound_volume: number;

  // Shop Type
  shop_type?: string;
  use_delivery?: boolean;
  use_kitchen?: boolean;

  // Payroll (Legacy/Payroll)
  afp_rate: number;
  sfs_rate: number;
  isr_rate: number;
  infotep_rate: number;
  enable_afp: boolean;
  enable_sfs: boolean;
  enable_isr: boolean;
  enable_infotep: boolean;
  afp_type: 'percentage' | 'fixed';
  sfs_type: 'percentage' | 'fixed';
  isr_type: 'percentage' | 'fixed';
  infotep_type: 'percentage' | 'fixed';

  // Email Reports
  email_reports_enabled?: boolean;
  email_reports_recipient?: string;
  email_reports_frequency?: string;
  // Advanced Settings
  backup_frequency?: string;
  log_retention_days?: number;
  pos_layout_grid_cols?: string | number;
  page_margin?: string;
  container_padding?: string;
  email_reports_last_sent?: string;
  logo_url?: string | null;
  // Business Hours
  business_hours?: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };

  pos_view_mode?: 'grid' | 'list';
  pos_layout_mode?: 'classic' | 'catalog';

  // Kitchen Display Settings
  kitchen_yellow_threshold?: number;
  kitchen_red_threshold?: number;
  kitchen_alert_threshold?: number;
  subscription_notification_email?: string;
  ai_api_key?: string | null;
  label_templates?: any[];
}

export const useStoreSettings = () => {
  const { data: store, isLoading: isUserStoreLoading, userId } = useUserStore();
  const storeId = store?.id;
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const fetchSettings = async () => {
    if (!storeId || storeId === 'undefined' || storeId === 'null') return null;

    // Validate UUID format
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(storeId)) {
      console.warn(`Invalid storeId format: ${storeId}. Skipping fetch_store_settings.`);
      return null;
    }

    // Check if store_settings exists for this store
    const { data: existingSettings, error: fetchError } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.message?.includes('AbortError') || fetchError.code === '20') {
        return null;
      }
      console.warn("Error fetching store_settings:", fetchError, JSON.stringify(fetchError));
    }

    // Load local settings to merge - PER USER AND PER STORE
    let userPersistedSettings = {};

    // Get from Auth User Metadata to persist across devices
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.pos_settings) {
        userPersistedSettings = session.user.user_metadata.pos_settings;
      }
    } catch (e) {
      console.warn("Could not fetch user metadata for settings", e);
    }

    // 2. Fallback to Local Storage - PER USER AND PER STORE
    let localSettings = {};
    const localKey = userId ? `posSettings_${storeId}_${userId}` : `posSettings_${storeId}`;
    const localSettingsStr = localStorage.getItem(localKey);
    
    const legacyKey = `posSettings_${storeId}`;
    const legacySettingsStr = !localSettingsStr ? localStorage.getItem(legacyKey) : null;
    const finalSettingsStr = localSettingsStr || legacySettingsStr;

    if (finalSettingsStr) {
      try {
        localSettings = JSON.parse(finalSettingsStr);
      } catch (e) {
        console.error("Error parsing local settings", e);
      }
    }

    // Order of precedence: defaults < DB shared < localStorage < user metadata
    // Remove global/shared POS UI preferences to ensure they are strictly per-user
    const cleanExistingSettings = { ...existingSettings };
    delete cleanExistingSettings.pos_view_mode;
    delete cleanExistingSettings.pos_layout_mode;
    delete cleanExistingSettings.pos_layout_grid_cols;

    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 1100;
    // Default UI values for any user that hasn't configured them yet
    const uiDefaults = {
      pos_view_mode: isMobileDevice ? 'list' : 'grid',
      pos_layout_mode: isMobileDevice ? 'catalog' : 'classic',
      pos_layout_grid_cols: 4
    };

    const mergedSettings = { 
      ...uiDefaults,
      ...cleanExistingSettings, 
      ...localSettings, 
      ...userPersistedSettings 
    };

    if (!existingSettings) {
      // Create default settings if they don't exist
      const defaultSettings = {
        store_id: storeId,
        invoice_prefix: 'FAC-',
        auto_increment: true,
        show_tax: true,
        default_tax_rate: 18,
        currency: 'DOP',
        payment_terms: 15,
        invoice_footer_text: 'Gracias por su preferencia',
        payment_methods: [
          { id: 'cash', name: 'Efectivo', enabled: true },
          { id: 'card', name: 'Tarjeta', enabled: true, surcharge_percentage: 0 },
          { id: 'transfer', name: 'Transferencia', enabled: true },
          { id: 'check', name: 'Cheque', enabled: true },
          { id: 'credit', name: 'Crédito', enabled: true }
        ],
        low_stock_alert: true,
        low_stock_threshold: 10,
        notifications_enabled: true,
        auto_backup: false,
        theme: 'light',
        language: 'es',
        timezone: 'America/Santo_Domingo',
        paper_size: '80mm',
        use_thermal_printer: false,
        thermal_printer_name: null,
        show_barcode: false, 
        invoice_font_size: 12, 
        web_order_sound_enabled: true,
        web_order_sound_type: 'chime',
        web_order_sound_volume: 0.7,
        afp_rate: 2.87,
        sfs_rate: 3.04,
        isr_rate: 0,
        infotep_rate: 1.0,
        enable_afp: true,
        enable_sfs: true,
        enable_isr: false,
        enable_infotep: false,
        afp_type: 'percentage',
        sfs_type: 'percentage',
        isr_type: 'percentage',
        infotep_type: 'percentage',
        subscription_notification_email: 'Haroldrospa@gmail.com'
      };

      const {
        pos_view_mode,
        pos_layout_mode,
        pos_layout_grid_cols,
        invoice_font_size,
        show_barcode,
        logo_width,
        business_hours,
        use_delivery,
        use_kitchen,
        shop_type,
        subscription_notification_email,
        ...dbPayload
      } = defaultSettings as any;

      const { data: newSettings, error: createError } = await supabase
        .from('store_settings')
        .insert(dbPayload)
        .select()
        .single();

      if (createError) {
        console.error("Error creating default store_settings:", createError);
        return { ...defaultSettings, ...mergedSettings } as any as StoreSettings;
      }
      return { ...newSettings, ...mergedSettings } as any as StoreSettings;
    }

    return mergedSettings as any as StoreSettings;
  };

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['storeSettings', storeId, userId],
    queryFn: fetchSettings,
    enabled: !!storeId,
    // Use the store_settings already embedded in useUserStore as initialData.
    // This makes cached navigations render instantly with no extra network request.
    initialData: (() => {
      const embeddedRaw = (store as any)?.store_settings;
      if (!embeddedRaw) return undefined;
      // Merge with local overrides (view mode, grid cols, etc.)
      const localKey = userId ? `posSettings_${storeId}_${userId}` : `posSettings_${storeId}`;
      const localStr = localStorage.getItem(localKey);
      
      // If we don't have local settings yet (e.g. new device), return undefined 
      // to force fetchSettings to run and pull from user_metadata.
      if (!localStr) return undefined;

      const embedded = { ...embeddedRaw };
      delete embedded.pos_view_mode;
      delete embedded.pos_layout_mode;
      delete embedded.pos_layout_grid_cols;

      const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 1100;
      const uiDefaults = {
        pos_view_mode: isMobileDevice ? 'list' : 'grid',
        pos_layout_mode: isMobileDevice ? 'catalog' : 'classic',
        pos_layout_grid_cols: 4
      };

      try {
        const local = JSON.parse(localStr);
        return { ...uiDefaults, ...embedded, ...local } as StoreSettings;
      } catch {
        return { ...uiDefaults, ...embedded } as StoreSettings;
      }
    })(),
    staleTime: 1000 * 60 * 60, // 60 minutes - store settings very rarely change
    gcTime: 1000 * 60 * 60 * 24, // 24 hours in cache
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cache on navigation - don't re-fetch every time component mounts
  });

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    if (!storeId) return;

    // 1. Save to Local Storage - PER USER
    const uiKeys = [
      'pos_view_mode', 'pos_layout_mode', 'pos_layout_grid_cols',
      'invoice_font_size', 'show_barcode', 'logo_width', 'business_hours',
      'use_delivery', 'use_kitchen', 'shop_type'
    ];
    
    try {
      const localKey = userId ? `posSettings_${storeId}_${userId}` : `posSettings_${storeId}`;
      const currentLocalStr = localStorage.getItem(localKey);
      const currentLocal = currentLocalStr ? JSON.parse(currentLocalStr) : {};

      const settingsToSave = { ...currentLocal };

      uiKeys.forEach(key => {
        if (key in newSettings) {
          // @ts-ignore
          settingsToSave[key] = newSettings[key];
        }
      });

      localStorage.setItem(localKey, JSON.stringify(settingsToSave));
      
      // 1b. ALSO persist to Supabase User Metadata for cross-device persistence
      const metadataUpdates: any = {};
      uiKeys.forEach(key => {
        if (key in newSettings) {
          // @ts-ignore
          metadataUpdates[key] = newSettings[key];
        }
      });

      if (Object.keys(metadataUpdates).length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const currentMetadata = userData.user.user_metadata?.pos_settings || {};
          await supabase.auth.updateUser({
            data: { 
              pos_settings: {
                ...currentMetadata,
                ...metadataUpdates
              }
            }
          });
        }
      }
    } catch (e) {
      console.error("Failed to save user settings", e);
    }

    setIsUpdating(true);

    // 2. Optimistic Update (React Query)
    await queryClient.cancelQueries({ queryKey: ['storeSettings', storeId, userId] });

    queryClient.setQueryData(['storeSettings', storeId, userId], (old: any) => ({
      ...old,
      ...newSettings
    }));

    try {
      // 3. Database Update (Store-wide)
      const {
        invoice_font_size,
        show_barcode,
        logo_width,
        pos_view_mode, // We filter these out from store-wide update if they are just UI choices
        pos_layout_mode,
        pos_layout_grid_cols, // Filter out layout grid cols too as it's a per-user UI preference
        ...dbPayload
      } = newSettings as any;

      if (Object.keys(dbPayload).length > 0) {
        const { error } = await supabase
          .from('store_settings')
          .update(dbPayload)
          .eq('store_id', storeId);

        if (error) {
          console.warn("Error updating store_settings (db sync failed, local kept):", error);
        }

        const effectiveUserId = userId || (store as any)?.owner_id;
        queryClient.setQueryData(['user-store', effectiveUserId], (old: any) => {
          if (!old) return old;
          const updated = {
            ...old,
            store_settings: {
              ...(old.store_settings || {}),
              ...newSettings
            }
          };
          if (effectiveUserId) {
            localStorage.setItem(`cobro_user_store_cache_${effectiveUserId}`, JSON.stringify(updated));
          }
          return updated;
        });

        if (!error) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['storeSettings', storeId, userId] }),
            queryClient.invalidateQueries({ queryKey: ['user-store'] }),
            queryClient.invalidateQueries({ queryKey: ['store'] })
          ]);
          await refetch();
        }
      }
    } catch (err) {
      console.warn("Exception updating store settings:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    settings: (settings || {}) as StoreSettings,
    loadingSettings: isLoading || isUserStoreLoading,
    isUpdating,
    updateSettings
  };
};
