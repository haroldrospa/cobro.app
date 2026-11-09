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
  const channelKey = getChannelName(payload.storeId, payload.registerId);

  // 1. Local browser BroadcastChannel for same-device or multi-window immediate sync
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

  // 2. Supabase Realtime Broadcast (WebSockets across separate tablets/devices)
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
};

export const subscribeCustomerDisplay = (
  storeId: string,
  registerId: string,
  onUpdate: (payload: CustomerDisplayPayload) => void
): (() => void) => {
  const channelKey = getChannelName(storeId, registerId);

  // 1. Local BroadcastChannel subscription
  let localBc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      localBc = new BroadcastChannel(channelKey);
      localBc.onmessage = (event) => {
        if (event.data && typeof event.data === 'object') {
          onUpdate(event.data as CustomerDisplayPayload);
        }
      };
    }
  } catch (e) {
    // Non-critical
  }

  // 2. Supabase Realtime Broadcast subscription
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

  // Cleanup handler
  return () => {
    try {
      if (localBc) {
        localBc.close();
      }
    } catch (e) {
      // Ignore
    }
    try {
      supabase.removeChannel(realtimeChannel);
    } catch (e) {
      // Ignore
    }
  };
};
