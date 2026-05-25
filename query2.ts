import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error, count } = await supabase
    .from('sales')
    .select('*', { count: 'exact' });
  console.log('Total sales in DB:', count);
}
run();
