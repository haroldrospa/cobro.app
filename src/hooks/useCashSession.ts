import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useProductsOffline';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface CashSession {
    id: string;
    store_id: string;
    opened_by: string;
    opened_at: string;
    initial_cash: number;
    status: 'open' | 'closed';
    closed_at?: string;
    closed_by?: string;
    total_sales_cash?: number;
    expected_cash?: number;
    actual_cash?: number;
    difference?: number;
    notes?: string;
}

const LS_SESSION_KEY = 'cobro_active_session';

const saveSessionToLS = (session: CashSession | null) => {
    if (session) {
        localStorage.setItem(LS_SESSION_KEY, JSON.stringify(session));
    } else {
        localStorage.removeItem(LS_SESSION_KEY);
    }
};

const getSessionFromLS = (): CashSession | null => {
    try {
        const raw = localStorage.getItem(LS_SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as CashSession;
    } catch {
        return null;
    }
};

export const useActiveSession = () => {
    const isOnline = useOnlineStatus();
    const { profile } = useUserProfile();
    const userId = profile?.id;
    const storeId = profile?.store_id;

    return useQuery({
        queryKey: ['active-cash-session', userId],
        queryFn: async () => {
            try {
                if (!userId) {
                    return getSessionFromLS();
                }

                if (isOnline && storeId) {
                    const { data, error } = await supabase
                        .from('cash_sessions')
                        .select('*')
                        .eq('store_id', storeId)
                        .eq('status', 'open')
                        .eq('opened_by', userId)
                        .order('opened_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (error) throw error;

                    // If server returned a different session than what was in localStorage, clear the stale one
                    const lsSession = getSessionFromLS();
                    if (lsSession && (!data || lsSession.id !== data.id)) {
                        console.log('[CashSession] Clearing stale localStorage session:', lsSession.id, '→ replacing with:', data?.id ?? 'null');
                        saveSessionToLS(data ?? null);
                    } else {
                        saveSessionToLS(data ?? null);
                    }

                    if (data) {
                        await offlineDB.put(OfflineStore.CASH_SESSIONS, data);
                    }
                    return (data as CashSession) ?? null;
                }

                // Offline path: try IndexedDB first, then localStorage
                const localSessions = await offlineDB.getAll<CashSession>(OfflineStore.CASH_SESSIONS);
                const activeLocal = localSessions.find(s => s.status === 'open' && s.opened_by === userId) ?? null;
                if (activeLocal) return activeLocal;

                return getSessionFromLS();

            } catch (error) {
                console.error('Error fetching active session, using local fallback:', error);
                try {
                    const localSessions = await offlineDB.getAll<CashSession>(OfflineStore.CASH_SESSIONS);
                    const activeLocal = localSessions.find(s => s.status === 'open' && s.opened_by === userId) ?? null;
                    if (activeLocal) return activeLocal;
                } catch { /* ignore */ }

                return getSessionFromLS();
            }
        },
        enabled: !!userId,
        retry: false,
        staleTime: 0,
    });
};


export const useOpenSession = () => {
    const queryClient = useQueryClient();
    const { profile } = useUserProfile();
    const userId = profile?.id;

    return useMutation({
        mutationFn: async ({ initialCash }: { initialCash: number }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const isOnline = navigator.onLine;

            if (isOnline) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('store_id')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!profileData?.store_id) throw new Error('No store found');

                // Check if there's already an open session to prevent duplicates
                const { data: existingSessions } = await supabase
                    .from('cash_sessions')
                    .select('id')
                    .eq('store_id', profileData.store_id)
                    .eq('opened_by', user.id)
                    .eq('status', 'open')
                    .limit(1);

                if (existingSessions && existingSessions.length > 0) {
                    throw new Error('Ya tienes una sesión de caja abierta. Debes cerrarla antes de abrir una nueva.');
                }

                // @ts-ignore
                const { data, error } = await supabase
                    .from('cash_sessions')
                    .insert({
                        store_id: profileData.store_id,
                        opened_by: user.id,
                        initial_cash: initialCash,
                        status: 'open'
                    })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // OFFLINE: Create session locally
                console.log('📵 Sin conexión - Abriendo sesión de caja localmente');

                const localProfile = await offlineDB.get<any>(OfflineStore.SETTINGS, 'user_profile');
                const storeId = localProfile?.store_id;

                if (!storeId) throw new Error('No se pudo identificar la tienda. Conéctate a internet al menos una vez primero.');

                const localSessions = await offlineDB.getAll<CashSession>(OfflineStore.CASH_SESSIONS);
                const existingOpen = localSessions.find(s => s.status === 'open' && s.opened_by === user.id);
                if (existingOpen) {
                    throw new Error('Ya tienes una sesión de caja abierta localmente. Ciérrala antes de abrir una nueva.');
                }

                const sessionId = crypto.randomUUID();
                const newSession: CashSession = {
                    id: sessionId,
                    store_id: storeId,
                    opened_by: user.id,
                    initial_cash: initialCash,
                    status: 'open',
                    opened_at: new Date().toISOString(),
                };

                await offlineDB.put(OfflineStore.CASH_SESSIONS, newSession);
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.CASH_SESSIONS,
                    operation: 'CREATE',
                    data: newSession,
                });

                return newSession;
            }
        },
        onSuccess: async (newItem) => {
            // Save to localStorage for instant offline access
            saveSessionToLS(newItem ?? null);
            // Update IndexedDB
            if (newItem) {
                await offlineDB.put(OfflineStore.CASH_SESSIONS, newItem);
            }
            // Instant UI update
            if (userId) {
                queryClient.setQueryData(['active-cash-session', userId], newItem);
            }
            queryClient.setQueryData(['active-cash-session'], newItem);
            queryClient.invalidateQueries({ queryKey: ['active-cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
        }
    });
};


export const useCloseSession = () => {
    const queryClient = useQueryClient();
    const { profile } = useUserProfile();
    const userId = profile?.id;

    return useMutation({
        mutationFn: async ({ sessionId, closingData }: { sessionId: string, closingData: any }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // ALWAYS update local database first to ensure UI consistency
            const localSession = await offlineDB.get<CashSession>(OfflineStore.CASH_SESSIONS, sessionId);
            const closedLocalSession = {
                ...(localSession || { id: sessionId }),
                ...closingData,
                status: 'closed' as const,
                closed_at: new Date().toISOString(),
                closed_by: user.id
            };
            
            await offlineDB.put(OfflineStore.CASH_SESSIONS, closedLocalSession);
            saveSessionToLS(null); // Clear LS immediately

            // If offline, just queue the sync
            if (!navigator.onLine) {
                console.log('📵 Sin conexión - Sesión cerrada localmente');
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.CASH_SESSIONS,
                    operation: 'UPDATE',
                    data: closedLocalSession,
                });
                return closedLocalSession;
            }

            // Online path: update Supabase
            // We close ALL open sessions for this user to prevent "phantom" sessions
            const { data, error } = await supabase
                .from('cash_sessions')
                .update({
                    ...closingData,
                    status: 'closed',
                    closed_by: user.id,
                    closed_at: new Date().toISOString()
                })
                .eq('opened_by', user.id)
                .eq('status', 'open')
                .select();

            if (error) {
                // If remote update fails (e.g. session not found yet), rely on sync queue
                console.warn('Remote update failed, queuing for sync:', error);
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.CASH_SESSIONS,
                    operation: 'UPDATE',
                    data: closedLocalSession,
                });
                return closedLocalSession;
            }
            
            const closedItem = data?.[0] || closedLocalSession;
            return closedItem;
        },
        onSuccess: async (data) => {
            // Remove from localStorage since session is now closed
            saveSessionToLS(null);
            // Update IndexedDB
            if (data) {
                await offlineDB.put(OfflineStore.CASH_SESSIONS, data);
            }
            // Instant UI update to trigger opening dialog
            if (userId) {
                queryClient.setQueryData(['active-cash-session', userId], null);
            }
            queryClient.setQueryData(['active-cash-session'], null);
            queryClient.invalidateQueries({ queryKey: ['active-cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
            queryClient.invalidateQueries({ queryKey: ['daily-closings'] }); // If we link reporting to this
        }
    });
};


export const useOpenSessions = (options?: { enabled?: boolean }) => {
    const { profile } = useUserProfile();
    const storeId = profile?.store_id;

    return useQuery({
        queryKey: ['store-open-sessions', storeId],
        queryFn: async () => {
            if (!storeId) return [];

            // Try online first
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            const { data, error } = await supabase
                .from('cash_sessions')
                .select('id, opened_by, opened_at, status, store_id, initial_cash, opener:opened_by(id, full_name, role)')
                .eq('store_id', storeId)
                .eq('status', 'open')
                .order('opened_at', { ascending: false })
                .limit(20);

            if (!error && data) {
                // Update local cache for these specific sessions
                for (const session of data) {
                    await offlineDB.put(OfflineStore.CASH_SESSIONS, session);
                }
                return data;
            }

            // Offline fallback: only show sessions from last 48h to avoid ghosts
            const twoDaysAgo = new Date();
            twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

            const localSessions = await offlineDB.getAll<CashSession>(OfflineStore.CASH_SESSIONS);
            return localSessions.filter(s => 
                s.store_id === storeId && 
                s.status === 'open' && 
                new Date(s.opened_at) > twoDaysAgo
            );
        },
        enabled: options?.enabled !== undefined ? (options.enabled && !!storeId) : !!storeId,
        refetchInterval: 1000 * 60 * 2, // Reduced: 2 min is enough for shift monitoring (was 30s — too aggressive on mobile)
    });
};

export const useSessionHistory = (options?: { enabled?: boolean }) => {
    const { profile } = useUserProfile();
    const storeId = profile?.store_id;

    return useQuery({
        queryKey: ['cash-session-history', storeId],
        queryFn: async () => {
            if (!storeId) return [];

            // Try online first
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*, opener:opened_by(full_name, role), closer:closed_by(full_name, role)')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                for (const session of data) {
                    await offlineDB.put(OfflineStore.CASH_SESSIONS, session);
                }
                return data;
            }

            // Fallback to offline
            const localSessions = await offlineDB.getAll<CashSession>(OfflineStore.CASH_SESSIONS);
            return localSessions
                .filter(s => s.store_id === storeId)
                .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
                .slice(0, 50);
        },
        enabled: options?.enabled !== undefined ? (options.enabled && !!storeId) : !!storeId,
        refetchInterval: 1000 * 60 * 10, // 10 min — shift history changes rarely, no need to check every 5min
    });
};
