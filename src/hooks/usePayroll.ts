
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/hooks/useUserStore';

export interface Payroll {
    id: string;
    store_id: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    status: 'draft' | 'processed' | 'paid';
    created_at: string;
}

export interface DeductionDetail {
    amount: number;
    reason: string;
}

export interface PayrollItem {
    id: string;
    payroll_id: string;
    profile_id: string | null;
    employee_name: string;
    base_salary: number;
    bonuses: number;

    tss: number;
    infotep: number;
    regalia: number;
    severance: number;

    deductions: number; // Sum of details
    deductions_details?: DeductionDetail[]; // Array of detailed deductions

    net_salary: number;
    status: 'pending' | 'paid';
    note?: string;
}

export const usePayroll = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: userStore } = useUserStore();

    // 1. Fetch Payrolls
    const { data: payrolls = [], isLoading: loadingPayrolls } = useQuery({
        queryKey: ['payrolls', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('payrolls')
                .select('*')
                .eq('store_id', userStore.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Payroll[];
        },
        enabled: !!userStore?.id
    });

    // 2. Create Payroll
    const createPayrollMutation = useMutation({
        mutationFn: async ({ start, end, frequency = 'monthly' }: { start: Date, end: Date, frequency?: 'monthly' | 'biweekly' | 'weekly' }) => {
            if (!userStore?.id) throw new Error("No store selected");

            // A. Fetch Store Settings (from store_settings, where the real toggle values live)
            const { data: storeData, error: storeError } = await supabase
                .from('store_settings')
                .select('*')
                .eq('store_id', userStore.id)
                .maybeSingle();

            const sData = storeData as any;
            const settings = sData ? {
                    afp: sData.afp_rate ?? 2.87,
                    sfs: sData.sfs_rate ?? 3.04,
                    infotep: sData.infotep_rate ?? 1.0,
                    enable_afp: sData.enable_afp === true,
                    enable_sfs: sData.enable_sfs === true,
                    enable_infotep: sData.enable_infotep === true,
                    afp_type: sData.afp_type ?? 'percentage',
                    sfs_type: sData.sfs_type ?? 'percentage',
                    infotep_type: sData.infotep_type ?? 'percentage'
                } : {
                    afp: 2.87, sfs: 3.04, infotep: 1.0,
                    enable_afp: false, enable_sfs: false, enable_infotep: false,
                    afp_type: 'percentage', sfs_type: 'percentage', infotep_type: 'percentage'
                };

            // B. Create Record
            const { data: payroll, error: payrollError } = await supabase
                .from('payrolls')
                .insert({
                    store_id: userStore.id,
                    period_start: start.toISOString(),
                    period_end: end.toISOString(),
                    status: 'draft',
                    total_amount: 0
                })
                .select()
                .single();

            if (payrollError) throw payrollError;

            // --- "BEST EFFORT" PHASE ---
            try {
                console.log('[PAYROLL] Starting Best Effort phase for payroll:', payroll.id);

                // C. Fetch Employees and Profiles for robust matching
                const { data: rawEmployees, error: empError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, base_salary, default_deduction, default_deduction_note, is_active, include_in_payroll')
                    .eq('store_id', userStore.id);

                // Skip inactive employees AND anyone explicitly flagged out of payroll
                // (app users with access but no salary). `!== false` treats missing/null
                // as included, so existing rows keep working before the flag is ever set.
                const employees = rawEmployees ? rawEmployees.filter(emp =>
                    (emp as any).is_active !== false && (emp as any).include_in_payroll !== false
                ) : [];

                console.log('[PAYROLL] Fetched employees:', employees?.length || 0, 'Error:', empError);

                if (empError) {
                    console.error("[PAYROLL] Error fetching employees", empError);
                    return payroll;
                }

                if (!employees || employees.length === 0) {
                    console.warn('[PAYROLL] No employees found');
                    return payroll;
                }

                // C2. Fetch Customers for credit syncing
                const { data: customers, error: custError } = await supabase
                    .from('customers')
                    .select('id, profile_id, credit_used, name, email')
                    .eq('store_id', userStore.id);
                
                console.log('[PAYROLL] Fetched customers:', customers?.length || 0, 'Error:', custError);
                
                // Sort customers by credit_used DESC to ensure we pick the one with debt if duplicates exist
                const sortedCustomers = customers ? [...customers].sort((a, b) => (Number(b.credit_used) || 0) - (Number(a.credit_used) || 0)) : [];
                
                if (customers) {
                    console.log('[PAYROLL] Customers with profile_id:', customers.filter(c => c.profile_id).map(c => ({ name: c.name, profile_id: c.profile_id, debt: c.credit_used })));
                }

                const divisor = frequency === 'weekly' ? 4 : frequency === 'biweekly' ? 2 : 1;

                // D. Generate Items
                const items = employees.map((emp: any) => {
                    const base = (emp.base_salary || 0) / divisor;

                    // --- Process Deductions ---
                    let empDetails: DeductionDetail[] = [];
                    // Fallback to note parsing if detailed column is missing or empty
                    if (emp.default_deduction_note && emp.default_deduction_note.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(emp.default_deduction_note);
                            if (Array.isArray(parsed)) empDetails = parsed;
                        } catch (e) {
                            // ignore
                        }
                    } else if ((emp.default_deduction || 0) > 0) {
                        empDetails = [{ amount: emp.default_deduction, reason: emp.default_deduction_note || "Descuento General" }];
                    }

                    // Divide deductions
                    const dividedDetails = empDetails.map(d => ({ ...d, amount: Math.round((d.amount / divisor) * 100) / 100 }));
                    let totalDeductions = dividedDetails.reduce((s, d) => s + d.amount, 0);

                    // --- Calculate TSS & Infotep ---
                    let afpPart = 0;
                    let sfsPart = 0;

                    if (settings.enable_afp) {
                        if (settings.afp_type === 'fixed') afpPart = settings.afp;
                        else afpPart = base * (settings.afp / 100);
                    }

                    if (settings.enable_sfs) {
                        if (settings.sfs_type === 'fixed') sfsPart = settings.sfs;
                        else sfsPart = base * (settings.sfs / 100);
                    }

                    const calculatedTss = Math.round((afpPart + sfsPart) * 100) / 100;

                    let calculatedInfotep = 0;
                    if (settings.enable_infotep) {
                        if (settings.infotep_type === 'fixed') calculatedInfotep = settings.infotep;
                        else calculatedInfotep = base * (settings.infotep / 100);
                    }
                    calculatedInfotep = Math.round(calculatedInfotep * 100) / 100;

                    // Add TSS/Infotep to deductions details for transparency
                    if (calculatedTss > 0) {
                        dividedDetails.push({ reason: 'TSS (Seguro/AFP)', amount: calculatedTss });
                        totalDeductions += calculatedTss;
                    }
                    if (calculatedInfotep > 0) {
                        dividedDetails.push({ reason: 'INFOTEP', amount: calculatedInfotep });
                        totalDeductions += calculatedInfotep;
                    }

                    // Auto-collect Employee Credit/Debt (Local profiles field)
                    const profileCreditDue = (emp as any).credit_used || 0;
                    if (profileCreditDue > 0) {
                        const creditDeduction = {
                            reason: 'Cobro de Adelanto (Manual)',
                            amount: profileCreditDue
                        };
                        dividedDetails.push(creditDeduction);
                        totalDeductions += profileCreditDue;
                    }

                    // Auto-collect POS Customer Debt (Linked via profile_id OR Email OR Partial Name)
                    const linkedCustomer = sortedCustomers?.find(c => c.profile_id === emp.id) || 
                                          sortedCustomers?.find(c => c.email && emp.email && c.email.toLowerCase().trim() === emp.email.toLowerCase().trim()) ||
                                          sortedCustomers?.find(c => {
                                              const cName = (c.name || '').toLowerCase().trim();
                                              const eName = (emp.full_name || '').toLowerCase().trim();
                                              return cName.includes(eName) || eName.includes(cName);
                                          });
                    
                    if (linkedCustomer && (linkedCustomer.credit_used || 0) > 0) {
                        const posCreditDeduction = {
                            reason: 'Cobro de Crédito POS',
                            amount: Number(linkedCustomer.credit_used) || 0
                        };
                        dividedDetails.push(posCreditDeduction);
                        totalDeductions += posCreditDeduction.amount;
                    }

                    return {
                        payroll_id: payroll.id,
                        store_id: userStore.id,
                        profile_id: emp.id,
                        employee_name: emp.full_name || 'Desconocido',
                        base_salary: base,
                        bonuses: 0,
                        tss: calculatedTss,
                        infotep: calculatedInfotep,
                        regalia: 0,
                        severance: 0,
                        deductions: totalDeductions,
                        deductions_details: dividedDetails,
                        net_salary: Math.max(0, (base - totalDeductions)),
                    };
                });

                // E. Safe Insert Strategy
                if (items.length > 0) {
                    try {
                        const cleanItems = items.map(item => {
                            const { tss, infotep, regalia, severance, deductions_details, ...dbItem } = item as any;
                            return {
                                ...dbItem,
                                status: 'pending',
                                note: dbItem.note || (deductions_details ? JSON.stringify(deductions_details) : null)
                            };
                        });
                        
                        const { error } = await supabase.from('payroll_items').insert(cleanItems);
                        if (error) throw error;
                    } catch (err) {
                        console.error("[PAYROLL] Save error:", err);
                    }
                }
            } catch (globalError) {
                console.error("[PAYROLL] Non-fatal error populating payroll", globalError);
            }

            return payroll;
        },
        onSuccess: () => {
            toast({ title: "Nómina Generada", description: "Proceso completado." });
        },
        onError: (e) => {
            console.error(e);
            toast({ title: "Error", description: "Hubo un problema iniciando la nómina.", variant: "destructive" });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
        }
    });

    // 3. Fetch Items
    const fetchPayrollItems = async (payrollId: string) => {
        const { data, error } = await supabase
            .from('payroll_items')
            .select('*')
            .eq('payroll_id', payrollId)
            .order('employee_name');
        if (error) throw error;

        return data.map((item: any) => {
            let details = item.deductions_details;
            if (!Array.isArray(details) || details.length === 0) {
                if (item.note && item.note.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(item.note);
                        if (Array.isArray(parsed)) details = parsed;
                    } catch (e) { /* ignore */ }
                }
            }
            return {
                ...item,
                deductions_details: (details as DeductionDetail[]) || []
            };
        }) as PayrollItem[];
    };

    // 4. Update Item
    const updatePayrollItemMutation = useMutation({
        mutationFn: async (item: Partial<PayrollItem> & { id: string }) => {
            const payload = { ...item };
            // Sanitize payload: remove virtual columns
            delete (payload as any).tss;
            delete (payload as any).infotep;
            delete (payload as any).regalia;
            delete (payload as any).severance;
            delete (payload as any).deductions_details;

            if (item.deductions_details) {
                payload.deductions = item.deductions_details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                payload.note = JSON.stringify(item.deductions_details);
            }
            const { error } = await supabase.from('payroll_items').update(payload).eq('id', item.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
        }
    });

    // 5. Delete Payroll
    const deletePayrollMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('payrolls').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
            toast({ title: "Eliminado", description: "La nómina ha sido eliminada." });
        }
    });

    // 6. Finalize
    const finalizePayrollMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error: payrollError } = await supabase.from('payrolls').update({ status: 'paid' }).eq('id', id);
            if (payrollError) throw payrollError;

            const { data: items } = await supabase.from('payroll_items').select('profile_id, note').eq('payroll_id', id);

            for (const item of (items || [])) {
                if (!item.profile_id) continue;
                let details = [];
                try { details = item.note ? JSON.parse(item.note) : []; } catch(e) {}
                
                const manualAdvance = details.find((d: any) => d.reason === 'Cobro de Adelanto (Manual)' || d.reason === 'Cobro de Crédito / Adelantos');
                if (manualAdvance && manualAdvance.amount > 0) {
                    await supabase.rpc('adjust_employee_credit', { profile_id: item.profile_id, amount: -manualAdvance.amount });
                }

                const posCredit = details.find((d: any) => d.reason === 'Cobro de Crédito POS');
                if (posCredit && posCredit.amount > 0) {
                    const { data: customer } = await supabase.from('customers').select('id, credit_used').eq('profile_id', item.profile_id).maybeSingle();
                    if (customer) {
                        const newCredit = Math.max(0, (customer.credit_used || 0) - posCredit.amount);
                        await supabase.from('customers').update({ credit_used: newCredit }).eq('id', customer.id);
                    }
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast({ title: "Pagado", description: "Nómina pagada y créditos liquidados." });
        }
    });
    
    // Helper: check if two names share at least 2 words (handles "Harold Rosado" vs "Harold Manuel Rosado Pacheco")
    const namesOverlap = (nameA: string, nameB: string): boolean => {
        const wordsA = nameA.toLowerCase().trim().split(/\s+/);
        const wordsB = nameB.toLowerCase().trim().split(/\s+/);
        const matches = wordsA.filter(w => w.length > 2 && wordsB.includes(w));
        return matches.length >= 2;
    };

    // 7. Sync Credits for current draft
    // Reads REAL debt from unpaid sales and updates taxes based on current settings
    const syncPayrollCredits = async (payrollId: string, currentItems: PayrollItem[]) => {
        if (!userStore?.id) throw new Error("No store selected");

        // Step 1: Get all data needed
        const [{ data: customers }, { data: profiles }, { data: storeData }] = await Promise.all([
            supabase.from('customers').select('id, profile_id, name, email, credit_used').eq('store_id', userStore.id),
            supabase.from('profiles').select('id, email').eq('store_id', userStore.id),
            supabase.from('store_settings').select('*').eq('store_id', userStore.id).maybeSingle()
        ]);

        if (!customers) return currentItems;

        const sData = storeData as any;
        const settings = {
            enable_afp: sData?.enable_afp === true,
            enable_sfs: sData?.enable_sfs === true,
            enable_infotep: sData?.enable_infotep === true
        };

        // Step 2: Get REAL balances from unpaid sales
        const { data: unpaidSales } = await supabase
            .from('sales')
            .select('customer_id, total, amount_paid, payment_status, status')
            .neq('payment_status', 'paid');

        const realBalances: Record<string, number> = {};
        (unpaidSales || []).forEach((sale: any) => {
            if (sale.customer_id && sale.status !== 'cancelled') {
                const debt = (sale.total || 0) - (sale.amount_paid || 0);
                if (debt > 0) {
                    realBalances[sale.customer_id] = (realBalances[sale.customer_id] || 0) + debt;
                }
            }
        });

        const sortedCustomers = [...customers].sort((a, b) => (realBalances[b.id] || 0) - (realBalances[a.id] || 0));

        let syncCount = 0;
        const updatedItems = currentItems.map(item => {
            const profile = profiles?.find(p => p.id === item.profile_id);
            const linkedCustomer = 
                sortedCustomers.find(c => c.profile_id && c.profile_id === item.profile_id) ||
                sortedCustomers.find(c => c.email && profile?.email && c.email.toLowerCase().trim() === profile.email.toLowerCase().trim()) ||
                sortedCustomers.find(c => (c.name || '').toLowerCase().trim() === (item.employee_name || '').toLowerCase().trim()) ||
                sortedCustomers.find(c => namesOverlap(c.name || '', item.employee_name || ''));

            const realDebt = linkedCustomer ? (realBalances[linkedCustomer.id] || 0) : 0;
            
            // Re-build details respecting CURRENT store settings
            let newDetails = [...(item.deductions_details || [])];
            
            // 1. Debt Handling
            newDetails = newDetails.filter(d => d.reason !== 'Cobro de Crédito POS');
            if (realDebt > 0) {
                newDetails.push({ reason: 'Cobro de Crédito POS', amount: realDebt });
                syncCount++;
            }

            // 2. Tax Handling: Respect enable_afp/sfs/infotep
            // If they are OFF in settings, remove them from details even if they were there before
            const hasTaxesEnabled = settings.enable_afp || settings.enable_sfs;
            
            newDetails = newDetails.filter(d => {
                const reason = (d.reason || '').toLowerCase().trim();
                // Broad matching for tax terms including all variations of generic labels
                const isTaxLine = reason.includes('tss') || 
                                 reason.includes('sfs') || 
                                 reason.includes('afp') || 
                                 reason.includes('seguro') || 
                                 reason.includes('deducción') || 
                                 reason.includes('deduccion') ||
                                 reason.includes('general') ||
                                 reason === ''; // Empty reasons are usually automatic taxes

                if (isTaxLine) {
                    return hasTaxesEnabled;
                }
                if (reason.includes('infotep')) {
                    return settings.enable_infotep;
                }
                return true;
            });

            // If they are ON but missing, add them (using the existing scalar value as reference)
            if (hasTaxesEnabled && item.tss > 0 && !newDetails.find(d => d.reason.includes('TSS'))) {
                newDetails.push({ reason: 'TSS (Seguro/AFP)', amount: item.tss });
            }
            if (settings.enable_infotep && item.infotep > 0 && !newDetails.find(d => d.reason.includes('INFOTEP'))) {
                newDetails.push({ reason: 'INFOTEP', amount: item.infotep });
            }

            const totalDeductions = newDetails.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            
            return {
                ...item,
                deductions: totalDeductions,
                deductions_details: newDetails,
                // Recalculate net respecting if tss/infotep should be subtracted
                net_salary: Math.max(0, (item.base_salary + (item.bonuses || 0) - totalDeductions))
            };
        });

        console.log(`[PAYROLL-SYNC] Done. Updated ${syncCount} employees with debt.`);
        return updatedItems;
    };


    return {
        payrolls,
        loadingPayrolls,
        createPayroll: createPayrollMutation.mutateAsync,
        deletePayroll: deletePayrollMutation.mutateAsync,
        fetchPayrollItems,
        updatePayrollItem: updatePayrollItemMutation.mutateAsync,
        finalizePayroll: finalizePayrollMutation.mutateAsync,
        syncPayrollCredits
    };
};
