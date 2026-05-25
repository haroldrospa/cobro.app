-- Expand the order_status CHECK constraint on open_orders
-- to allow new delivery flow statuses: 'preparing', 'shipped', 'confirmed'

-- 1. Drop the existing constraint (we don't know its exact name, try both common naming conventions)
ALTER TABLE public.open_orders DROP CONSTRAINT IF EXISTS open_orders_order_status_check;
ALTER TABLE public.open_orders DROP CONSTRAINT IF EXISTS open_orders_status_check;
ALTER TABLE public.open_orders DROP CONSTRAINT IF EXISTS order_status_check;

-- 2. Add the new expanded constraint with all valid statuses
ALTER TABLE public.open_orders
  ADD CONSTRAINT open_orders_order_status_check
  CHECK (order_status IN (
    'pending',
    'confirmed',
    'preparing',
    'shipped',
    'completed',
    'cancelled',
    'processing'
  ));
