import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name')
  if (error) console.error(error);
  
  for(let p of (data||[])) {
     if(p.name.toLowerCase().includes('delivery')) console.log('Found product:', p.name);
  }
}
run();
