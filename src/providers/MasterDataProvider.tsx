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

  // Solo se considera cargando si realmente no hay datos en memoria/caché
  const isLoading = !!storeId && (
    (isLoadingCustomers && customers.length === 0) ||
    (isLoadingCategories && categories.length === 0) ||
    (isLoadingProducts && products.length === 0)
  );

  const refreshMasterData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    refetchCustomers();
    refetchCategories();
  }, [queryClient, refetchCustomers, refetchCategories]);

  const refreshRef = React.useRef(refreshMasterData);
  React.useEffect(() => {
    refreshRef.current = refreshMasterData;
  }, [refreshMasterData]);

  // Escuchar eventos de sincronización para actualizar los datos automáticamente al terminar el sync (con debounce)
  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleSyncComplete = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        refreshRef.current();
      }, 1000);
    };

    window.addEventListener('cobro:sync-completed', handleSyncComplete);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('cobro:sync-completed', handleSyncComplete);
    };
  }, []);

  // Refrescar automáticamente solo cuando el storeId cambie
  const lastStoreIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (storeId && storeId !== lastStoreIdRef.current) {
      lastStoreIdRef.current = storeId;
      refreshRef.current();
    }
  }, [storeId]);

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
