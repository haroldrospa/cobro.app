const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Fetching open sessions with user profiles...');
  const { data: sessions, error: sessionError } = await supabase
    .from('cash_sessions')
    .select('*, opener:opened_by(*)')
    .eq('status', 'open');

  if (sessionError) {
    console.error('Error fetching sessions:', sessionError);
    return;
  }

  console.log(`Found ${sessions.length} open sessions:`);
  for (const session of sessions) {
    const userId = session.opened_by?.id || session.opened_by || session.user_id;
    const userName = session.opener?.full_name || 'Unknown';
    const storeId = session.opener?.store_id || null;

    console.log(`\nSession ID: ${session.id}`);
    console.log(`  User: ${userName} (${userId})`);
    console.log(`  Store ID: ${storeId}`);
    
    // Check open_orders for this user & store
    const { data: orders, error: ordersError } = await supabase
      .from('open_orders')
      .select('*')
      .eq('profile_id', userId)
      .eq('payment_status', 'pending')
      .eq('source', 'pos');
      
    if (ordersError) {
      console.error(`  Error fetching orders for user:`, ordersError);
    } else {
      console.log(`  All POS pending open orders: ${orders.length}`);
      orders.forEach(o => {
        console.log(`    - ID: ${o.id}, Order #: ${o.order_number}, Customer: ${o.customer_name}, Total: ${o.total}, Notes: ${o.notes}, Source: ${o.source}`);
      });
    }

    // Now query with the exact condition in CloseDayDialog
    const query = supabase
      .from('open_orders')
      .select('id', { count: 'exact', head: false })
      .eq('profile_id', userId)
      .eq('payment_status', 'pending')
      .eq('source', 'pos');
      
    if (storeId) {
      query.eq('store_id', storeId);
    }
    
    // Or filter for delta tickets
    query.or('notes.is.null,notes.not.ilike.[ACTUALIZADO]%');
    
    const { data: exactOrders, count, error: exactError } = await query;
    if (exactError) {
      console.error(`  Error running exact CloseDay query:`, exactError);
    } else {
      console.log(`  Exact CloseDay query pending count: ${count}`);
      if (exactOrders && exactOrders.length > 0) {
        console.log(`  Matching Order IDs:`, exactOrders.map(o => o.id));
      }
    }
  }
}

check();
