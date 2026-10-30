import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import {
  DigitalServiceWallet,
  DigitalServiceTransaction,
  DigitalServicesConfig,
  DigitalServiceTopupRequest,
  DigitalServiceWalletMovement,
  InvoiceQueryResult,
  PrepaidMeterResult,
  RemittanceRateResult,
} from '@/types/digitalServices';
import { toast } from '@/hooks/use-toast';

export const COBROAPP_BANK_ACCOUNTS = [
  {
    id: 'bhd',
    bank: 'Banco BHD',
    accountType: 'Cuenta Corriente',
    accountNumber: '123-456789-0',
    holder: 'CobroApp Dominicana SRL',
    rnc: '1-32-45678-9',
    badge: 'BHD',
  },
  {
    id: 'popular',
    bank: 'Banco Popular Dominicano',
    accountType: 'Cuenta Corriente',
    accountNumber: '987-654321-0',
    holder: 'CobroApp Dominicana SRL',
    rnc: '1-32-45678-9',
    badge: 'Popular',
  },
  {
    id: 'banreservas',
    bank: 'Banreservas',
    accountType: 'Cuenta de Ahorros',
    accountNumber: '240-123456-7',
    holder: 'CobroApp Dominicana SRL',
    rnc: '1-32-45678-9',
    badge: 'Banreservas',
  },
];

export const useDigitalServices = () => {
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  const storeId = userStore?.id;

  // 1. Obtener la Billetera de la Tienda
  const {
    data: wallet,
    isLoading: isLoadingWallet,
    refetch: refetchWallet
  } = useQuery<DigitalServiceWallet | null>({
    queryKey: ['digital-services-wallet', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data, error } = await supabase
        .from('digital_services_wallets')
        .select('id, store_id, balance, credit_limit, total_sold, total_cost, total_commission, custom_commission_rate, is_active, created_at, updated_at')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        console.warn('Error al obtener billetera de servicios:', error.message);
        return null;
      }

      if (!data) {
        // Inicializar billetera vía RPC segura
        const { data: createdWallet, error: rpcError } = await supabase
          .rpc('get_or_create_store_wallet', { p_store_id: storeId });
        if (rpcError) {
          console.error('Error al inicializar billetera:', rpcError);
          return null;
        }
        return createdWallet as DigitalServiceWallet;
      }

      return data as DigitalServiceWallet;
    },
    enabled: !!storeId,
    staleTime: 1000 * 30, // 30 segundos
  });

  // 2. Obtener Configuración Global de la Plataforma
  const { data: config, refetch: refetchConfig } = useQuery<DigitalServicesConfig | null>({
    queryKey: ['digital-services-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('digital_services_config')
        .select('id, api_environment, api_base_url, api_key, api_secret, default_recharge_commission_rate, default_bill_fixed_commission, deposit_bank_details, is_active')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error config digital services:', error);
        return null;
      }
      return data as DigitalServicesConfig;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // 3. Mutación para Procesar Venta de Recarga / Servicio
  const processSaleMutation = useMutation({
    mutationFn: async (payload: {
      carrier: string;
      phone: string;
      amount: number;
      service_type: 'recharge' | 'data_package' | 'bill_payment' | 'prepaid_power' | 'remittance';
      target_name?: string;
      package_id?: string;
      commission?: number;
      cost_amount?: number;
      metadata?: any;
    }) => {
      if (!storeId) throw new Error('No se ha detectado el comercio actual.');

      const clientReferenceId = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Determinar acción según el tipo de servicio
      let action: 'recharge' | 'pay_bill' | 'charge_prepaid_power' | 'send_remittance' = 'recharge';
      if (payload.service_type === 'bill_payment') {
        action = 'pay_bill';
      } else if (payload.service_type === 'prepaid_power') {
        action = 'charge_prepaid_power';
      } else if (payload.service_type === 'remittance') {
        action = 'send_remittance';
      }

      // Llamada a la Edge Function segura
      const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
        body: {
          action,
          carrier: payload.carrier,
          phone: payload.phone,
          amount: payload.amount,
          service_type: payload.service_type,
          target_name: payload.target_name,
          package_id: payload.package_id,
          commission: payload.commission,
          cost_amount: payload.cost_amount,
          metadata: payload.metadata,
          client_reference_id: clientReferenceId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error de conexión con el servicio de recargas.');
      }

      if (!data?.ok) {
        throw new Error(data?.error || 'No se pudo completar la transacción.');
      }

      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-wallet', storeId] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-transactions', storeId] });
      const pinMsg = data.pin ? ` PIN: ${data.pin}` : '';
      toast({
        title: '¡Transacción Exitosa! 🎉',
        description: `Servicio de RD$ ${data.amount} aplicado a ${data.carrier.toUpperCase()} (${data.target_number}). Tu ganancia neta: RD$ ${data.commission}.${pinMsg}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al procesar servicio',
        description: err.message || 'Ocurrió un error inesperado.',
        variant: 'destructive',
      });
    },
  });

  // 4. Consultas en Tiempo Real a la API de RecargameYa
  const queryInvoice = async (companyId: string, contractNumber: string): Promise<InvoiceQueryResult> => {
    const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
      body: {
        action: 'query_invoice',
        company_id: companyId,
        contract_number: contractNumber,
      },
    });

    if (error || !data?.ok) {
      throw new Error(data?.error || error?.message || 'No se pudo consultar la factura.');
    }
    return data.data as InvoiceQueryResult;
  };

  const queryPrepaidAccount = async (provider: string, contract: string): Promise<PrepaidMeterResult> => {
    const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
      body: {
        action: 'query_prepaid_account',
        provider,
        contract,
      },
    });

    if (error || !data?.ok) {
      throw new Error(data?.error || error?.message || 'No se pudo consultar la cuenta prepago.');
    }
    return data.data as PrepaidMeterResult;
  };

  const getRemittanceRate = async (walletType: string = 'moncash'): Promise<RemittanceRateResult> => {
    const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
      body: {
        action: 'query_remittance_rate',
        wallet_type: walletType,
      },
    });

    if (error || !data?.ok) {
      throw new Error(data?.error || error?.message || 'No se pudo obtener la tasa de remesa.');
    }
    return data.data as RemittanceRateResult;
  };

  const checkHealth = async () => {
    const { data, error } = await supabase.functions.invoke('recargameya-proxy', {
      body: {
        action: 'check_health',
      },
    });

    if (error || !data?.ok) {
      throw new Error(data?.error || error?.message || 'Error al conectar con la API de RecargameYa.');
    }
    return data;
  };

  // 5. Enviar Solicitud de Recarga de Saldo con Comprobante (Transferencia Bancaria)
  const submitTopupRequestMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      bankName: string;
      referenceNumber: string;
      receiptFile?: File | null;
      notes?: string;
    }) => {
      if (!storeId) throw new Error('No hay comercio activo');
      let receiptUrl = '';

      if (payload.receiptFile) {
        try {
          const fileExt = payload.receiptFile.name.split('.').pop() || 'jpg';
          const fileName = `topup-${storeId}-${Date.now()}.${fileExt}`;
          const filePath = `digital-topups/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, payload.receiptFile, { upsert: true });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(filePath);
            receiptUrl = publicUrlData?.publicUrl || filePath;
          }
        } catch (uploadErr) {
          console.warn('Advertencia al subir comprobante a storage:', uploadErr);
        }
      }

      const bankNameWithRef = `${payload.bankName}${payload.referenceNumber ? ` (Ref: ${payload.referenceNumber})` : ''}`;

      // 1. Intentar llamar al RPC oficial submit_digital_service_topup si existiera
      let rpcSuccessful = false;
      let rpcResult: any = null;
      try {
        const { data, error } = await supabase.rpc('submit_digital_service_topup', {
          p_store_id: storeId,
          p_amount: payload.amount,
          p_bank_name: payload.bankName,
          p_reference_number: payload.referenceNumber,
          p_receipt_url: receiptUrl || null,
          p_notes: payload.notes || null,
        });

        if (!error && data) {
          rpcSuccessful = true;
          rpcResult = data;
        }
      } catch (rpcEx) {
        console.warn('RPC submit_digital_service_topup no disponible:', rpcEx);
      }

      // Sincronizar siempre en payment_reports para visibilidad inmediata en panel maestro
      try {
        await supabase
          .from('payment_reports')
          .insert({
            company_id: storeId,
            amount: payload.amount,
            currency: 'DOP',
            bank_name: bankNameWithRef,
            proof_url: receiptUrl || null,
            status: 'pending',
            target_plan_id: 'digital_topup',
            admin_note: payload.notes 
              ? `Recarga de Billetera Digital. Ref: ${payload.referenceNumber}. ${payload.notes}` 
              : `Recarga de Billetera Digital. Ref: ${payload.referenceNumber}`
          });
      } catch (prEx: any) {
        console.warn('payment_reports insert fallback:', prEx);
      }

      return rpcResult || { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-topup-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      toast({
        title: '¡Solicitud de Recarga Enviada! 📋',
        description: 'Tu comprobante de transferencia fue enviado. En breve la administración validará y activará tu saldo.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al enviar solicitud',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 6. Aprobar Solicitud de Recarga (Solo Admins)
  const approveTopupMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // 1. Intentar con RPC oficial
      try {
        const { data, error } = await supabase.rpc('approve_digital_service_topup', {
          p_request_id: requestId,
        });
        if (!error && data) return data;
      } catch (rpcErr) {
        console.warn('RPC approve_digital_service_topup no disponible:', rpcErr);
      }

      // 2. Respaldo directo: buscar solicitud en digital_services_topup_requests o payment_reports
      let topupItem: any = null;
      try {
        const { data: dsData } = await supabase
          .from('digital_services_topup_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (dsData) {
          topupItem = dsData;
          await supabase
            .from('digital_services_topup_requests')
            .update({
              status: 'approved',
              approved_at: new Date().toISOString()
            })
            .eq('id', requestId);
        }
      } catch (e) {
        console.warn('Error buscando en digital_services_topup_requests:', e);
      }

      if (!topupItem) {
        const { data: prData } = await supabase
          .from('payment_reports')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (prData) {
          topupItem = {
            store_id: prData.company_id,
            amount: prData.amount,
            bank_name: prData.bank_name,
            reference_number: prData.reference_number
          };
          await supabase
            .from('payment_reports')
            .update({
              status: 'approved',
              admin_note: 'Aprobado desde panel'
            })
            .eq('id', requestId);
        }
      }

      if (!topupItem) {
        throw new Error('No se encontró el registro de la solicitud para aprobar');
      }

      const targetStoreId = topupItem.store_id;
      const amountToCredit = Number(topupItem.amount || 0);

      // Acreditar saldo directamente a digital_services_wallets
      const { data: walletData } = await supabase
        .from('digital_services_wallets')
        .select('id, balance')
        .eq('store_id', targetStoreId)
        .maybeSingle();

      const currentBal = Number(walletData?.balance || 0);
      const newBal = currentBal + amountToCredit;

      if (walletData) {
        await supabase
          .from('digital_services_wallets')
          .update({
            balance: newBal,
            updated_at: new Date().toISOString()
          })
          .eq('id', walletData.id);
      } else {
        await supabase
          .from('digital_services_wallets')
          .insert({
            store_id: targetStoreId,
            balance: newBal,
            is_active: true
          });
      }

      // Registrar movimiento de auditoría
      await supabase
        .from('digital_services_wallet_movements')
        .insert({
          store_id: targetStoreId,
          type: 'deposit',
          amount: amountToCredit,
          balance_before: currentBal,
          balance_after: newBal,
          description: `Aprobación de recarga bancaria (${topupItem.bank_name || 'Transferencia'})`,
          reference_id: topupItem.reference_number || null
        });

      return { success: true, amount: amountToCredit };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-topup-requests'] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-movements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      toast({
        title: '¡Recarga Aprobada y Activada! ✅',
        description: `Se han acreditado RD$ ${data.amount} exitosamente a la billetera.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al aprobar recarga',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 7. Rechazar Solicitud de Recarga (Solo Admins)
  const rejectTopupMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      try {
        const { data, error } = await supabase.rpc('reject_digital_service_topup', {
          p_request_id: requestId,
          p_reason: reason || null,
        });
        if (!error && data) return data;
      } catch (e) {
        console.warn('RPC reject_digital_service_topup no disponible:', e);
      }

      // Respaldo directo en ambas tablas
      await supabase
        .from('digital_services_topup_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason || 'Rechazado por administración'
        })
        .eq('id', requestId);

      await supabase
        .from('payment_reports')
        .update({
          status: 'rejected',
          admin_note: reason || 'Rechazado por administración'
        })
        .eq('id', requestId);

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-topup-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      toast({
        title: 'Solicitud rechazada',
        description: 'La solicitud de recarga ha sido marcada como rechazada.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al rechazar solicitud',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 8. Mutación para Agregar Saldo Directo a Billetera (Fallback Seguro)
  const addBalanceMutation = useMutation({
    mutationFn: async ({ amount, description, reference }: { amount: number; description?: string; reference?: string }) => {
      if (!storeId) throw new Error('No hay comercio activo');
      const { data, error } = await supabase.rpc('add_store_digital_balance', {
        p_store_id: storeId,
        p_amount: amount,
        p_description: description || 'Recarga de saldo manual',
        p_reference: reference || null
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-services-wallet', storeId] });
      queryClient.invalidateQueries({ queryKey: ['digital-services-movements', storeId] });
      toast({
        title: 'Saldo acreditado',
        description: 'La billetera de recargas ha sido actualizada con éxito.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al recargar saldo',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  // 9. Actualizar Credenciales de API (Solo Admins)
  const updateApiConfigMutation = useMutation({
    mutationFn: async (payload: {
      apiKey: string;
      apiSecret: string;
      environment: 'sandbox' | 'production';
      baseUrl?: string;
    }) => {
      const { error } = await supabase
        .from('digital_services_config')
        .update({
          api_key: payload.apiKey,
          api_secret: payload.apiSecret,
          api_environment: payload.environment,
          api_base_url: payload.baseUrl || 'https://recargameya.com/api/v1/public',
        })
        .not('id', 'is', null);

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      refetchConfig();
      toast({
        title: 'Credenciales Actualizadas',
        description: 'La configuración de RecargameYa API ha sido guardada exitosamente.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al guardar credenciales',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return {
    wallet,
    config,
    isLoadingWallet,
    refetchWallet,
    refetchConfig,
    processSale: processSaleMutation.mutateAsync,
    isProcessingSale: processSaleMutation.isPending,
    addBalance: addBalanceMutation.mutateAsync,
    isAddingBalance: addBalanceMutation.isPending,
    submitTopupRequest: submitTopupRequestMutation.mutateAsync,
    isSubmittingTopup: submitTopupRequestMutation.isPending,
    approveTopup: approveTopupMutation.mutateAsync,
    isApprovingTopup: approveTopupMutation.isPending,
    rejectTopup: rejectTopupMutation.mutateAsync,
    isRejectingTopup: rejectTopupMutation.isPending,
    queryInvoice,
    queryPrepaidAccount,
    getRemittanceRate,
    checkHealth,
    updateApiConfig: updateApiConfigMutation.mutateAsync,
    isUpdatingConfig: updateApiConfigMutation.isPending,
  };
};

// Hook especializado para consultas de solicitudes de recarga de saldo
export const useDigitalTopupRequests = (options?: { status?: string; allStores?: boolean }) => {
  const { data: userStore } = useUserStore();
  const storeId = userStore?.id;
  const statusFilter = options?.status;
  const allStores = options?.allStores ?? false;

  return useQuery<DigitalServiceTopupRequest[]>({
    queryKey: ['digital-services-topup-requests', storeId, statusFilter, allStores],
    queryFn: async () => {
      const results: DigitalServiceTopupRequest[] = [];
      const seenIds = new Set<string>();

      // 1. Intentar consultar tabla dedicada digital_services_topup_requests
      try {
        let query = supabase
          .from('digital_services_topup_requests')
          .select(`
            id,
            store_id,
            user_id,
            amount,
            bank_name,
            reference_number,
            receipt_url,
            notes,
            status,
            rejection_reason,
            approved_by,
            approved_at,
            created_at,
            updated_at,
            stores:store_id (name),
            profiles:user_id (full_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!allStores && storeId) {
          query = query.eq('store_id', storeId);
        }

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
          data.forEach((item: any) => {
            results.push(item as DigitalServiceTopupRequest);
            seenIds.add(item.reference_number || item.id);
          });
        }
      } catch (err) {
        console.warn('Error fetching digital_services_topup_requests:', err);
      }

      // 2. Consultar payment_reports con target_plan_id = 'digital_topup' para respaldo y unificación
      try {
        let prQuery = supabase
          .from('payment_reports')
          .select('*')
          .or('target_plan_id.eq.digital_topup,admin_note.ilike.%Billetera%')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!allStores && storeId) {
          prQuery = prQuery.eq('company_id', storeId);
        }

        if (statusFilter && statusFilter !== 'all') {
          prQuery = prQuery.eq('status', statusFilter);
        }

        const { data: prData, error: prErr } = await prQuery;
        if (!prErr && prData) {
          prData.forEach((pr: any) => {
            const refMatch = pr.bank_name?.match(/Ref:\s*([^)]+)/) || pr.admin_note?.match(/Ref:\s*([^.\s]+)/);
            const refNum = pr.reference_number || (refMatch ? refMatch[1].trim() : 'S/R');
            const key = refNum !== 'S/R' ? refNum : pr.id;
            if (!seenIds.has(key)) {
              results.push({
                id: pr.id,
                store_id: pr.company_id,
                user_id: undefined,
                amount: Number(pr.amount || 0),
                bank_name: pr.bank_name?.replace(/\s*\(Ref:.*\)/, '') || 'Transferencia',
                reference_number: refNum,
                receipt_url: pr.proof_url || null,
                notes: pr.admin_note || 'Recarga de Billetera Digital',
                status: pr.status || 'pending',
                rejection_reason: pr.admin_note,
                approved_by: undefined,
                approved_at: pr.updated_at,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                stores: pr.store_name ? { name: pr.store_name } : undefined,
              } as DigitalServiceTopupRequest);
              seenIds.add(key);
            }
          });
        }
      } catch (prCatch) {
        console.warn('Error fetching payment_reports fallback for topup:', prCatch);
      }

      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    staleTime: 1000 * 15,
  });
};

// Hook especializado para transacciones con paginación y filtro de fecha (Respeta regla de no consultas masivas)
export const useDigitalTransactions = (options?: { limit?: number; dateFilter?: 'today' | 'this_week' | 'this_month' | 'all' }) => {
  const { data: userStore } = useUserStore();
  const storeId = userStore?.id;
  const limit = options?.limit || 30;
  const dateFilter = options?.dateFilter || 'today';

  return useQuery<DigitalServiceTransaction[]>({
    queryKey: ['digital-services-transactions', storeId, dateFilter, limit],
    queryFn: async () => {
      if (!storeId) return [];

      let query = supabase
        .from('digital_services_transactions')
        .select('id, store_id, user_id, service_type, carrier, target_number, target_name, amount, amount_charged, commission, client_reference_id, external_id, status, error_message, metadata, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const now = new Date();
      if (dateFilter === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfDay);
      } else if (dateFilter === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', startOfMonth);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching transactions:', error);
        return [];
      }
      return (data || []) as DigitalServiceTransaction[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 20, // 20s
  });
};

// Hook para consultar el historial de movimientos de saldo (auditoría de depósitos y débitos)
export const useDigitalWalletMovements = (options?: { limit?: number; storeId?: string }) => {
  const { data: userStore } = useUserStore();
  const storeId = options?.storeId || userStore?.id;
  const limit = options?.limit || 50;

  return useQuery<DigitalServiceWalletMovement[]>({
    queryKey: ['digital-services-movements', storeId, limit],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('digital_services_wallet_movements')
        .select('id, store_id, type, amount, balance_before, balance_after, description, reference_id, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Error al consultar movimientos de billetera:', error);
        return [];
      }

      return (data || []) as DigitalServiceWalletMovement[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 15,
  });
};
