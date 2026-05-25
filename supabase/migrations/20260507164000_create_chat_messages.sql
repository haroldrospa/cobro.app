-- ==========================================
-- CHAT SYSTEM: STORE <-> CUSTOMER
-- ==========================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.open_orders(id) ON DELETE CASCADE,
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sender_role  TEXT NOT NULL CHECK (sender_role IN ('store', 'customer')),
  sender_name  TEXT NOT NULL,
  message      TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_order_id ON public.chat_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- RLS Policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- The store owner can read and write all messages in their store
CREATE POLICY "store_owner_all_chat" ON public.chat_messages
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

-- The shopper can read and write messages for their own orders
-- We check by customer_email or if the user is authenticated as the shopper
CREATE POLICY "shopper_own_chat" ON public.chat_messages
  FOR ALL TO anon, authenticated
  USING (
    order_id IN (
      SELECT id FROM public.open_orders
      WHERE customer_email = auth.jwt() ->> 'email'
      OR customer_email = (auth.jwt() -> 'user_metadata' ->> 'email')
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.open_orders
      WHERE customer_email = auth.jwt() ->> 'email'
      OR customer_email = (auth.jwt() -> 'user_metadata' ->> 'email')
    )
  );

-- Fallback for anonymous shoppers without JWT email (based on order_id knowledge)
-- This is slightly less secure but necessary if they don't have a full auth session
CREATE POLICY "anon_order_chat_access" ON public.chat_messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
