const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function check() {
  const storeId = '026721e8-b488-4796-a431-b12b540b4e4d';
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, status, store_id, category_id')
    .eq('store_id', storeId);
  console.log('Error:', error);
  console.log('Products count:', products?.length);
  console.log('Products:', products);
}
check();
