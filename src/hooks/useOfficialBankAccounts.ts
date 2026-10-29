import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OfficialBankAccount {
  id: string;
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  taxId: string; // Cédula o RNC
  currency: string;
  email?: string;
  isActive: boolean;
  badge?: string;
}

export const DEFAULT_OFFICIAL_BANK_ACCOUNTS: OfficialBankAccount[] = [
  {
    id: 'banreservas',
    bank: 'Banco de Reservas',
    accountType: 'Cuenta de Ahorros',
    accountNumber: '9601938364',
    holder: 'HAROLD MANUEL ROSADO PACHECO',
    taxId: '402-1824665-6',
    currency: 'DOP',
    email: 'haroldrospa@gmail.com',
    isActive: true,
    badge: 'Banreservas',
  },
  {
    id: 'bhd',
    bank: 'Banco BHD',
    accountType: 'Cuenta Corriente',
    accountNumber: '123-456789-0',
    holder: 'HAROLD MANUEL ROSADO PACHECO',
    taxId: '402-1824665-6',
    currency: 'DOP',
    email: 'haroldrospa@gmail.com',
    isActive: true,
    badge: 'BHD',
  },
  {
    id: 'popular',
    bank: 'Banco Popular Dominicano',
    accountType: 'Cuenta Corriente',
    accountNumber: '987-654321-0',
    holder: 'HAROLD MANUEL ROSADO PACHECO',
    taxId: '402-1824665-6',
    currency: 'DOP',
    email: 'haroldrospa@gmail.com',
    isActive: true,
    badge: 'Popular',
  },
];

export const useOfficialBankAccounts = () => {
  const queryClient = useQueryClient();

  const { data: accounts = DEFAULT_OFFICIAL_BANK_ACCOUNTS, isLoading } = useQuery<OfficialBankAccount[]>({
    queryKey: ['official-bank-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_global_settings')
        .select('value')
        .eq('id', 'official_bank_accounts')
        .maybeSingle();

      if (error) {
        console.warn('Error fetching official bank accounts:', error);
        return DEFAULT_OFFICIAL_BANK_ACCOUNTS;
      }

      if (!data?.value) {
        return DEFAULT_OFFICIAL_BANK_ACCOUNTS;
      }

      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as OfficialBankAccount[];
        }
      } catch (e) {
        console.warn('Error parsing official bank accounts:', e);
      }

      return DEFAULT_OFFICIAL_BANK_ACCOUNTS;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const saveAccountsMutation = useMutation({
    mutationFn: async (newAccounts: OfficialBankAccount[]) => {
      const jsonStr = JSON.stringify(newAccounts);
      const { error } = await supabase
        .from('admin_global_settings')
        .upsert({
          id: 'official_bank_accounts',
          value: jsonStr,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return newAccounts;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['official-bank-accounts'], updated);
      queryClient.invalidateQueries({ queryKey: ['official-bank-accounts'] });
      toast({
        title: 'Cuentas Bancarias Actualizadas',
        description: 'Las cuentas bancarias oficiales han sido guardadas y sincronizadas en toda la plataforma.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al guardar cuentas',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const activeAccounts = accounts.filter((a) => a.isActive !== false);

  return {
    accounts,
    activeAccounts,
    isLoading,
    saveAccounts: saveAccountsMutation.mutateAsync,
    isSaving: saveAccountsMutation.isPending,
  };
};
