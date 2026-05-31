const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('Looking for orders named "gastos" or "senor sueter verde"...\n');
  
  // Search by customer name
  const { data: byName, error: e1 } = await supabase
    .from('open_orders')
    .select('*')
    .or('customer_name.ilike.%gastos%,customer_name.ilike.%sueter%');
  
  console.log('By customer name:', JSON.stringify(byName, null, 2), e1 ? 'ERROR:' + e1.message : '');
  
  // Search ALL pending POS orders 
  const { data: allPending, error: e2 } = await supabase
    .from('open_orders')
    .select('id, customer_name, order_number, profile_id, store_id, payment_status, source, notes, total')
    .eq('source', 'pos')
    .eq('payment_status', 'pending')
    .limit(20);
  
  console.log('\nAll pending POS orders:', JSON.stringify(allPending, null, 2), e2 ? 'ERROR:' + e2.message : '');
}

main().catch(console.error);
