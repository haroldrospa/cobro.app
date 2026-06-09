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
  
  console.log(`Fetching products for store ${targetStoreId} using range...`);
  
  const startTime = Date.now();
  const { data, error, count } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name),
      barcodes:product_barcodes(id, barcode, label)
    `, { count: 'exact' })
    .eq('store_id', targetStoreId)
    .order('name')
    .range(0, 999);
    
  const duration = Date.now() - startTime;
  
  if (error) {
    console.error('Query Error:', error);
  } else {
    console.log(`Fetched ${data.length} products (out of total count ${count}) in ${duration}ms`);
  }
}

run();
