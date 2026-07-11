import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const storeId = '54d86334-fb76-4c22-98b0-292c739ead6a';

  const { data: sequences, error } = await supabase
    .from('invoice_sequences')
    .select('*')
    .eq('store_id', storeId)
    .eq('invoice_type_id', 'B02');

  console.log('\n--- B02 SEQUENCE FOR HAROLD STORE ---');
  if (error) console.error(error);
  else console.log(sequences);
}

run();
