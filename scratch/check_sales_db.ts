import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const storeId = '54d86334-fb76-4c22-98b0-292c739ead6a';
  
  console.log('Checking if B02-00000125 exists...');

  const { data, error } = await supabase
    .from('sales')
    .select('invoice_number, created_at')
    .eq('store_id', storeId)
    .eq('invoice_number', 'B02-00000125');

  if (error) {
     console.error('Error:', error);
  } else {
     console.log('Result:', data);
  }
}

run();
