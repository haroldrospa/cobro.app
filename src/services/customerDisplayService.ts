import { supabase } from '@/integrations/supabase/client';
import { CustomerDisplayPayload } from '@/types/customerDisplay';

const LS_REGISTER_ID_KEY = 'cobro_pos_register_id';
const LS_REGISTER_NAME_KEY = 'cobro_pos_register_name';

export const getStoredRegisterId = (): string => {
  try {
    const saved = localStorage.getItem(LS_REGISTER_ID_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {
    // Ignore
  }
  return 'caja_1';
};

export const getStoredRegisterName = (): string => {
  try {
    const saved = localStorage.getItem(LS_REGISTER_NAME_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {
    // Ignore
  }
  return 'Caja 1';
};

export const setStoredRegisterConfig = (id: string, name: string) => {
  try {
    localStorage.setItem(LS_REGISTER_ID_KEY, id.trim().toLowerCase());
    localStorage.setItem(LS_REGISTER_NAME_KEY, name.trim());
  } catch (e) {
    // Ignore
  }
};

// Singleton channel tracker to prevent duplicate connections
const activeChannels = new Map<string, any>();
const localBroadcastChannels = new Map<string, BroadcastChannel>();

export const getChannelName = (storeId: string, registerId: string): string => {
  const cleanStore = (storeId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRegister = (registerId || 'caja_1').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `customer-display:${cleanStore}:${cleanRegister}`;
};

export const broadcastCustomerDisplay = async (payload: CustomerDisplayPayload) => {
  const primaryChannelKey = getChannelName(payload.storeId, payload.registerId);
  const defaultChannelKey = getChannelName('default', payload.registerId);
  
  const targetChannelKeys = [primaryChannelKey];
  if (primaryChannelKey !== defaultChannelKey) {
    targetChannelKeys.push(defaultChannelKey);
  }

  // 1. Local browser BroadcastChannel for same-device or multi-window immediate sync
  for (const channelKey of targetChannelKeys) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        let bc = localBroadcastChannels.get(channelKey);
        if (!bc) {
          bc = new BroadcastChannel(channelKey);
          localBroadcastChannels.set(channelKey, bc);
        }
        bc.postMessage(payload);
      }
    } catch (e) {
      // Non-critical
    }
  }

  // 2. Supabase Realtime Broadcast (WebSockets across separate tablets/devices without auth)
  for (const channelKey of targetChannelKeys) {
    try {
      let channel = activeChannels.get(channelKey);
      if (!channel) {
        channel = supabase.channel(channelKey, {
          config: {
            broadcast: { self: false, ack: false },
          },
        });
        channel.subscribe();
        activeChannels.set(channelKey, channel);
      }

      await channel.send({
        type: 'broadcast',
        event: 'display_update',
        payload,
      });
    } catch (err) {
      console.warn('[CustomerDisplay] Error broadcasting update:', err);
    }
  }
};

export const subscribeCustomerDisplay = (
  storeId: string,
  registerId: string,
  onUpdate: (payload: CustomerDisplayPayload) => void
): (() => void) => {
  const primaryKey = getChannelName(storeId, registerId);
  const defaultKey = getChannelName('default', registerId);
  const keysToSubscribe = [primaryKey];
  if (primaryKey !== defaultKey) {
    keysToSubscribe.push(defaultKey);
  }

  const localBcs: BroadcastChannel[] = [];
  const realtimeChannels: any[] = [];

  for (const channelKey of keysToSubscribe) {
    // 1. Local BroadcastChannel subscription
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const localBc = new BroadcastChannel(channelKey);
        localBc.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            onUpdate(event.data as CustomerDisplayPayload);
          }
        };
        localBcs.push(localBc);
      }
    } catch (e) {
      // Non-critical
    }

    // 2. Supabase Realtime Broadcast subscription (Works anonymously without session)
    try {
      const realtimeChannel = supabase
        .channel(channelKey, {
          config: {
            broadcast: { self: false },
          },
        })
        .on('broadcast', { event: 'display_update' }, (response) => {
          if (response.payload) {
            onUpdate(response.payload as CustomerDisplayPayload);
          }
        })
        .subscribe();
      realtimeChannels.push(realtimeChannel);
    } catch (e) {
      // Non-critical
    }
  }

  // Cleanup handler
  return () => {
    for (const bc of localBcs) {
      try {
        bc.close();
      } catch (e) {
        // Ignore
      }
    }
    for (const ch of realtimeChannels) {
      try {
        supabase.removeChannel(ch);
      } catch (e) {
        // Ignore
      }
    }
  };
};
