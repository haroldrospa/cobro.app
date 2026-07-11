import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Checking if create_sale_transaction_v3 exists in the database...');

  const { data, error } = await supabase
    .from('sales')
    .select('id')
    .limit(1);

  if (error) {
     console.error('Database connection test failed:', error);
     return;
  }
  console.log('Database connection OK.');

  // Test executing the RPC with dummy UUID
  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  const { error: rpcError } = await supabase.rpc('create_sale_transaction_v3', {
      p_sale_id: dummyUuid,
      p_customer_id: null,
      p_invoice_type_id: 'B02',
      p_subtotal: 0,
      p_discount_total: 0,
      p_tax_total: 0,
      p_total: 0,
      p_payment_method: 'efectivo',
      p_amount_received: 0,
      p_change_amount: 0,
      p_split_cash: null,
      p_split_method: null,
      p_payment_status: 'paid',
      p_due_date: null,
      p_store_id: dummyUuid,
      p_profile_id: dummyUuid,
      p_items: []
  });

  if (rpcError) {
     console.log('RPC exists but returned error (which means it exists!):', rpcError.code, rpcError.message);
  } else {
     console.log('RPC exists and executed successfully!');
  }
}

run();
