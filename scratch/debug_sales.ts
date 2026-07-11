import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Connecting to Supabase:', supabaseUrl);

  // Let's get active cash sessions
  const { data: activeSessions, error: sessionError } = await supabase
    .from('cash_sessions')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(5);

  if (sessionError) {
    console.error('Error fetching cash sessions:', sessionError);
  } else {
    console.log('Latest cash sessions:');
    activeSessions.forEach(s => {
      console.log(`- ID: ${s.id}, User: ${s.opened_by}, Status: ${s.status}, Initial Cash: ${s.initial_cash}, Opened At: ${s.opened_at}, Closed At: ${s.closed_at}`);
    });
  }

  // 2. Get latest sales
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, invoice_number, total, created_at, store_id, profile_id, payment_status')
    .order('created_at', { ascending: false })
    .limit(10);

  if (salesError) {
    console.error('Error fetching sales:', salesError);
  } else {
    console.log('Latest sales in DB:');
    sales.forEach(s => {
      console.log(`- ID: ${s.id}, Inv: ${s.invoice_number}, Total: ${s.total}, Created At: ${s.created_at}, Store: ${s.store_id}, Profile: ${s.profile_id}, Status: ${s.payment_status}`);
    });
  }

  // 3. Search specifically for B02-00000121
  const { data: specificSale, error: specificError } = await supabase
    .from('sales')
    .select('id, invoice_number, total, created_at')
    .eq('invoice_number', 'B02-00000121')
    .maybeSingle();

  if (specificError) {
    console.error('Error searching specific sale:', specificError);
  } else {
    console.log('Search for B02-00000121 result:', specificSale);
  }
}

run();
