import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';
import { useAlanubeConfig } from './useAlanubeConfig';

export interface PurchaseReceiptItem {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    itbis?: number;
}

export interface PurchaseReceipt {
    id: string;
    store_id: string;
    supplier_id: string | null;
    supplier_name: string;
    supplier_rnc_cedula: string;
    ncf: string;
    ncf_type: 'E41' | 'B11';
    issue_date: string;
    description: string;
    subtotal: number;
    itbis_rate: number;
    itbis_amount: number;
    itbis_retained: number;
    itbis_retention_rate: number;
    isr_retention_rate: number;
    isr_retained: number;
    total_amount: number;
    total_net_paid: number;
    payment_method: string;
    category: string;
    status: 'EMITIDO' | 'ANULADO' | 'PENDIENTE';
    is_electronic: boolean;
    security_code?: string | null;
    qrcode_url?: string | null;
    alanube_id?: string | null;
    expense_id?: string | null;
    items: PurchaseReceiptItem[];
    created_at: string;
    updated_at: string;
}

export type CreatePurchaseReceiptDTO = Omit<
    PurchaseReceipt,
    'id' | 'created_at' | 'updated_at' | 'store_id' | 'status'
> & {
    status?: 'EMITIDO' | 'ANULADO' | 'PENDIENTE';
    create_expense?: boolean;
};

export const usePurchaseReceipts = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { config: alanubeConfig } = useAlanubeConfig();

    const storeId = userStore?.id;
    const isElectronicActive = alanubeConfig?.is_active || false;

    // Fetch Receipts
    const { data: receipts = [], isLoading } = useQuery({
        queryKey: ['purchase_receipts', storeId],
        enabled: !!storeId,
        queryFn: async (): Promise<PurchaseReceipt[]> => {
            if (!storeId) return [];

            try {
                const { data, error } = await supabase
                    .from('purchase_receipts' as any)
                    .select('*')
                    .eq('store_id', storeId)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.warn('[usePurchaseReceipts] Tabla no disponible aún, usando caché local:', error.message);
                    return getLocalReceipts(storeId);
                }

                const fetched = (data || []).map((item: any) => ({
                    ...item,
                    items: Array.isArray(item.items) ? item.items : [],
                    subtotal: Number(item.subtotal || 0),
                    itbis_amount: Number(item.itbis_amount || 0),
                    itbis_retained: Number(item.itbis_retained || 0),
                    isr_retained: Number(item.isr_retained || 0),
                    total_amount: Number(item.total_amount || 0),
                    total_net_paid: Number(item.total_net_paid || 0),
                })) as PurchaseReceipt[];

                // Save to local backup
                saveLocalReceipts(storeId, fetched);
                return fetched;
            } catch (err) {
                console.warn('[usePurchaseReceipts] Error leyendo supabase, usando fallback:', err);
                return getLocalReceipts(storeId);
            }
        }
    });

    // Helper to calculate the next sequence
    const getNextSequence = async (forceElectronic?: boolean): Promise<{ ncf: string; ncf_type: 'E41' | 'B11' }> => {
        const isElec = forceElectronic !== undefined ? forceElectronic : isElectronicActive;
        const prefix = isElec ? 'E41' : 'B11';
        const padLength = isElec ? 10 : 8;

        try {
            // Check invoice_sequences
            const { data: seqData } = await supabase
                .from('invoice_sequences')
                .select('current_number')
                .eq('invoice_type_id', 'B11')
                .maybeSingle();

            let nextNum = (seqData?.current_number || 0) + 1;

            // Also check maximum NCF already recorded in receipts
            const maxExistingNum = receipts
                .filter(r => r.ncf?.startsWith(prefix))
                .reduce((max, r) => {
                    const match = r.ncf.replace(prefix, '').match(/\d+/);
                    const num = match ? parseInt(match[0], 10) : 0;
                    return num > max ? num : max;
                }, 0);

            if (maxExistingNum >= nextNum) {
                nextNum = maxExistingNum + 1;
            }

            const formattedNum = String(nextNum).padStart(padLength, '0');
            return {
                ncf: `${prefix}${formattedNum}`,
                ncf_type: isElec ? 'E41' : 'B11'
            };
        } catch {
            const nextNum = (receipts.length + 1);
            const formattedNum = String(nextNum).padStart(padLength, '0');
            return {
                ncf: `${prefix}${formattedNum}`,
                ncf_type: isElec ? 'E41' : 'B11'
            };
        }
    };

    // Create Purchase Receipt Mutation
    const createMutation = useMutation({
        mutationFn: async (dto: CreatePurchaseReceiptDTO): Promise<PurchaseReceipt> => {
            if (!storeId) throw new Error('No hay tienda activa.');

            const now = new Date().toISOString();
            const receiptId = crypto.randomUUID();

            let finalExpenseId: string | null = null;

            // 1. Optionally create matching Expense record so Accounting stays 100% in sync
            if (dto.create_expense !== false) {
                try {
                    const expenseSaveDate = dto.issue_date ? new Date(dto.issue_date) : new Date();
                    const { data: expData, error: expError } = await supabase
                        .from('expenses')
                        .insert({
                            store_id: storeId,
                            date: expenseSaveDate.toISOString(),
                            description: `[${dto.ncf_type}] ${dto.description}`,
                            amount: dto.total_amount,
                            category: dto.category || 'Inventario',
                            supplier_id: dto.supplier_id || null,
                            invoice_number: dto.ncf,
                            created_at: now,
                        })
                        .select('id')
                        .single();

                    if (!expError && expData) {
                        finalExpenseId = expData.id;
                    }
                } catch (expErr) {
                    console.warn('[usePurchaseReceipts] No se pudo crear el gasto automático:', expErr);
                }
            }

            // 2. Prepare receipt payload
            const receiptData: PurchaseReceipt = {
                id: receiptId,
                store_id: storeId,
                supplier_id: dto.supplier_id || null,
                supplier_name: dto.supplier_name.trim(),
                supplier_rnc_cedula: dto.supplier_rnc_cedula.replace(/[^\d]/g, ''),
                ncf: dto.ncf,
                ncf_type: dto.ncf_type,
                issue_date: dto.issue_date || now,
                description: dto.description.trim(),
                subtotal: Number(dto.subtotal || 0),
                itbis_rate: Number(dto.itbis_rate || 0),
                itbis_amount: Number(dto.itbis_amount || 0),
                itbis_retained: Number(dto.itbis_retained || 0),
                itbis_retention_rate: Number(dto.itbis_retention_rate || 0),
                isr_retention_rate: Number(dto.isr_retention_rate || 0),
                isr_retained: Number(dto.isr_retained || 0),
                total_amount: Number(dto.total_amount || 0),
                total_net_paid: Number(dto.total_net_paid || 0),
                payment_method: dto.payment_method || 'cash',
                category: dto.category || 'Inventario',
                status: dto.status || 'EMITIDO',
                is_electronic: dto.is_electronic,
                security_code: dto.security_code || null,
                qrcode_url: dto.qrcode_url || (dto.is_electronic ? `https://dgii.gov.do/ecf/${dto.ncf}` : null),
                alanube_id: dto.alanube_id || null,
                expense_id: finalExpenseId || dto.expense_id || null,
                items: dto.items || [],
                created_at: now,
                updated_at: now
            };

            // 3. Save to Supabase (with graceful local fallback)
            try {
                const { data, error } = await supabase
                    .from('purchase_receipts' as any)
                    .insert(receiptData)
                    .select('*')
                    .single();

                if (error) {
                    console.warn('[usePurchaseReceipts] Guardando en almacenamiento local por falta de tabla:', error.message);
                    saveSingleLocalReceipt(storeId, receiptData);
                } else if (data) {
                    saveSingleLocalReceipt(storeId, data);
                }
            } catch {
                saveSingleLocalReceipt(storeId, receiptData);
            }

            // 4. Update Sequence in invoice_sequences
            try {
                const match = dto.ncf.replace(/^[A-Z]+\d*/, '');
                const seqDigits = match ? parseInt(match, 10) : 0;
                if (seqDigits > 0) {
                    await supabase
                        .from('invoice_sequences')
                        .upsert(
                            { invoice_type_id: 'B11', current_number: seqDigits, updated_at: now },
                            { onConflict: 'invoice_type_id' }
                        );
                }
            } catch (seqErr) {
                console.warn('[usePurchaseReceipts] Error actualizando secuencia:', seqErr);
            }

            // Invalidate queries so Expenses and Accounting instantly refresh
            queryClient.invalidateQueries({ queryKey: ['purchase_receipts', storeId] });
            queryClient.invalidateQueries({ queryKey: ['expenses', storeId] });
            queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });

            return receiptData;
        },
        onSuccess: (newReceipt) => {
            toast({
                title: "Comprobante e-CF 41 Emitido",
                description: `Comprobante ${newReceipt.ncf} para ${newReceipt.supplier_name} registrado exitosamente.`
            });
        },
        onError: (err: any) => {
            toast({
                title: "Error al emitir comprobante",
                description: err.message || "No se pudo emitir el comprobante de compras.",
                variant: "destructive"
            });
        }
    });

    // Cancel / Annul Receipt Mutation
    const cancelMutation = useMutation({
        mutationFn: async ({ receiptId, reason }: { receiptId: string; reason?: string }) => {
            if (!storeId) throw new Error('No hay tienda activa.');

            const target = receipts.find(r => r.id === receiptId);

            try {
                await supabase
                    .from('purchase_receipts' as any)
                    .update({ status: 'ANULADO', updated_at: new Date().toISOString() })
                    .eq('id', receiptId);
            } catch (err) {
                console.warn('[usePurchaseReceipts] Fallback cancel:', err);
            }

            // If it had a linked expense, we delete or update it
            if (target?.expense_id) {
                try {
                    await supabase
                        .from('expenses')
                        .delete()
                        .eq('id', target.expense_id);
                } catch (expErr) {
                    console.warn('[usePurchaseReceipts] Error cancelando gasto vinculado:', expErr);
                }
            }

            // Update local storage
            const updated = receipts.map(r => r.id === receiptId ? { ...r, status: 'ANULADO' as const } : r);
            saveLocalReceipts(storeId, updated);

            queryClient.invalidateQueries({ queryKey: ['purchase_receipts', storeId] });
            queryClient.invalidateQueries({ queryKey: ['expenses', storeId] });
            return true;
        },
        onSuccess: () => {
            toast({
                title: "Comprobante Anulado",
                description: "El comprobante de compras ha sido marcado como ANULADO y su impacto contable removido."
            });
        }
    });

    return {
        receipts,
        isLoading,
        getNextSequence,
        createPurchaseReceipt: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        cancelPurchaseReceipt: cancelMutation.mutateAsync,
        isCanceling: cancelMutation.isPending,
        isElectronicActive
    };
};

// ── Helpers locales de almacenamiento ──────────────────────────────────
function getLocalReceipts(storeId: string): PurchaseReceipt[] {
    try {
        const raw = localStorage.getItem(`purchase_receipts_${storeId}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalReceipts(storeId: string, list: PurchaseReceipt[]) {
    try {
        localStorage.setItem(`purchase_receipts_${storeId}`, JSON.stringify(list));
    } catch (e) {
        console.warn('Error saving local purchase receipts:', e);
    }
}

function saveSingleLocalReceipt(storeId: string, item: PurchaseReceipt) {
    const list = getLocalReceipts(storeId);
    const existingIdx = list.findIndex(r => r.id === item.id);
    if (existingIdx >= 0) {
        list[existingIdx] = item;
    } else {
        list.unshift(item);
    }
    saveLocalReceipts(storeId, list);
}
