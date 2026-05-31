const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Fetching all open orders...');
  const { data, error } = await supabase
    .from('open_orders')
    .select('id, order_number, customer_name, total, notes, source, payment_status, created_at, profile_id');
    
  if (error) {
    console.error('Error fetching open orders:', error);
  } else {
    console.log(`Found ${data.length} open orders:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
