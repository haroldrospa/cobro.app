import React, { createContext, useContext, ReactNode } from 'react';
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
  const { data: store } = useUserStore();
  const storeId = store?.id;

  // These hooks now have staleTime: Infinity, so they only fetch once
  const { data: customers = [], isLoading: isLoadingCustomers, refetch: refetchCustomers } = useCustomers();
  const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useCategories();
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useProductsOffline();

  const isLoading = isLoadingCustomers || isLoadingCategories || isLoadingProducts;

  const refreshMasterData = () => {
    refetchCustomers();
    refetchCategories();
    refetchProducts();
  };

  return (
    <MasterDataContext.Provider value={{
      customers,
      categories,
      products,
      isLoading,
      refreshMasterData
    }}>
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
