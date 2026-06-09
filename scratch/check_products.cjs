const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log('Fetching products to check cost vs price...');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, cost, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  console.log('\n--- PRODUCTS LIST ---');
  products.forEach(p => {
    const cost = p.cost || 0;
    const price = p.price || 0;
    const profit = price - cost;
    const profitPct = price > 0 ? (profit / price) * 100 : 0;
    const costPct = price > 0 ? (cost / price) * 100 : 0;
    console.log(`Product: ${p.name}`);
    console.log(`  Price: $${price}`);
    console.log(`  Cost:  $${cost}`);
    console.log(`  Profit: $${profit.toFixed(2)} (${profitPct.toFixed(1)}%)`);
    console.log(`  Cost%:  ${costPct.toFixed(1)}%`);
    console.log('------------------------');
  });
}

run();
