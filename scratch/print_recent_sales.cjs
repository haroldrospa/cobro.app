const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = 'test_user_1780928355747@example.com';
  const password = 'password123';
  
  const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
  const userId = authData.user.id;
  const targetStoreId = '54d86334-fb76-4c22-98b0-292c739ead6a'; // Mamajuana store ID
  
  await supabase.from('profiles').update({ store_id: targetStoreId }).eq('id', userId);

  // Get products to match
  let products = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data } = await supabase
      .from('products')
      .select('id, name, price, cost')
      .eq('store_id', targetStoreId)
      .range(from, from + step - 1);
    if (!data || data.length === 0) break;
    products = products.concat(data);
    if (data.length < step) break;
    from += step;
  }
  const productsMap = new Map();
  products.forEach(p => productsMap.set(p.id, p));

  console.log('Fetching last 15 sales...');
  const { data: sales, error } = await supabase
    .from('sales')
    .select('id, total, created_at, status, invoice_number, sale_items(product_id, quantity, total, subtotal, product:products(name))')
    .eq('store_id', targetStoreId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error(error);
    return;
  }

  sales.forEach(sale => {
    console.log(`\n=========================================`);
    console.log(`SALE ID: ${sale.id} | Invoice: ${sale.invoice_number}`);
    console.log(`Date: ${sale.created_at} | Status: ${sale.status}`);
    console.log(`Total Revenue: $${sale.total}`);
    
    let saleCalculatedCost = 0;
    let itemsCount = 0;
    
    sale.sale_items?.forEach(item => {
      itemsCount++;
      const prod = productsMap.get(item.product_id);
      const cost = prod ? (prod.cost || 0) : 0;
      const itemCost = cost * item.quantity;
      saleCalculatedCost += itemCost;
      
      console.log(`  - Item: ${item.product ? item.product.name : 'Unknown'} (${item.product_id})`);
      console.log(`    Qty: ${item.quantity} | Price: $${item.total / item.quantity} | Cost in DB: $${cost} | Total Item Cost: $${itemCost}`);
    });
    
    const profit = sale.total - saleCalculatedCost;
    const profitPct = sale.total > 0 ? (profit / sale.total) * 100 : 0;
    console.log(`Summary: Revenue: $${sale.total} | Cost: $${saleCalculatedCost.toFixed(2)} | Profit: $${profit.toFixed(2)} (${profitPct.toFixed(1)}% profit margin)`);
  });
}

run();
