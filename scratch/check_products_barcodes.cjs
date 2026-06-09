const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = 'test_user_1780928355747@example.com';
  const password = 'password123';
  const targetStoreId = '54d86334-fb76-4c22-98b0-292c739ead6a';
  
  console.log(`Signing in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }
  
  console.log('Auth successful.');
  
  const { count: prodCount, error: prodErr } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', targetStoreId);
    
  const { count: barcodeCount, error: barcodeErr } = await supabase
    .from('product_barcodes')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', targetStoreId);
    
  console.log(`Store ${targetStoreId} has:`);
  console.log(`- Products: ${prodCount} (Error: ${prodErr})`);
  console.log(`- Product Barcodes: ${barcodeCount} (Error: ${barcodeErr})`);
}

run();
