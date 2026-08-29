import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomers } from '@/hooks/useCustomers';
import { useCategories } from '@/hooks/useCategories';
import { useProductsOffline } from '@/hooks/useProductsOffline';
import { useUserStore } from '@/hooks/useUserStore';

interface MasterDataContextType {
  customers: any[];
  categories: any[];
  products: any[];
  isLoading: boolean;
  refreshMasterData: () => void;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export const MasterDataProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: store } = useUserStore();
  const storeId = store?.id;

  // These hooks now have staleTime: Infinity, so they only fetch once
  const { data: customers = [], isLoading: isLoadingCustomers, refetch: refetchCustomers } = useCustomers();
  const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useCategories();
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useProductsOffline();

  const isLoading = !!storeId && (isLoadingCustomers || isLoadingCategories || isLoadingProducts);

  const refreshMasterData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    refetchCustomers();
    refetchCategories();
    refetchProducts();
  }, [queryClient, refetchCustomers, refetchCategories, refetchProducts]);

  // Escuchar eventos de sincronización para actualizar los datos automáticamente al terminar el sync
  React.useEffect(() => {
    const handleSyncComplete = () => {
      console.log('🔄 MasterDataProvider: Sync completed event received, refreshing master data...');
      refreshMasterData();
    };

    window.addEventListener('cobro:sync-completed', handleSyncComplete);
    window.addEventListener('cobro:offline-products-updated', handleSyncComplete);
    return () => {
      window.removeEventListener('cobro:sync-completed', handleSyncComplete);
      window.removeEventListener('cobro:offline-products-updated', handleSyncComplete);
    };
  }, [refreshMasterData]);

  // Refrescar automáticamente cuando el storeId se resuelva para evitar condiciones de carrera al iniciar sesión
  React.useEffect(() => {
    if (storeId) {
      console.log('🔄 MasterDataProvider: Store ID resolved, refreshing master data...', storeId);
      refreshMasterData();
    }
  }, [storeId, refreshMasterData]);

  // Memoizado: sin esto, el objeto `value` se recreaba en CADA render de este
  // provider (que envuelve toda la app) — cualquier componente que consuma
  // useMasterData() (POS incluido) se re-renderizaba de más cada vez que
  // llegaba un evento de sync/auth, aunque products/customers/categories no
  // hubieran cambiado en absoluto.
  const value = React.useMemo(() => ({
    customers,
    categories,
    products,
    isLoading,
    refreshMasterData
  }), [customers, categories, products, isLoading, refreshMasterData]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
};

export const useMasterData = () => {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};
