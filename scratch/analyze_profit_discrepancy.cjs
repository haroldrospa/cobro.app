const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = 'test_user_1780928355747@example.com';
  const password = 'password123';
  
  console.log(`Signing in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }
  
  const userId = authData.user.id;
  console.log(`Auth successful. User ID: ${userId}`);

  const targetStoreId = '54d86334-fb76-4c22-98b0-292c739ead6a'; // Mamajuana store ID
  console.log(`Updating test user store_id to ${targetStoreId}...`);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ store_id: targetStoreId })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating store_id:', updateError);
  }

  console.log('Fetching all products...');
  let products = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, cost, is_variable_price')
      .eq('store_id', targetStoreId)
      .range(from, from + step - 1);

    if (prodError) {
      console.error('Error fetching products:', prodError);
      return;
    }

    if (!data || data.length === 0) break;
    products = products.concat(data);
    if (data.length < step) break;
    from += step;
  }

  const productsMap = new Map();
  products.forEach(p => {
    productsMap.set(p.id, p);
  });

  console.log(`Loaded ${products.length} products.`);

  console.log('Fetching sales and sale items...');
  // Let's query all sales to analyze
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, total, created_at, status, store_id, sale_items(product_id, quantity, total, subtotal, product:products(name))')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (salesError) {
    console.error('Error fetching sales:', salesError);
    return;
  }

  if (!sales || sales.length === 0) {
    console.error('No sales found at all!');
    return;
  }

  const validSales = sales.filter(s => s.status !== 'cancelled');
  console.log(`Loaded ${sales.length} total sales, ${validSales.length} valid sales (not cancelled).`);

  const storeId = sales[0].store_id;
  console.log(`Analyzing sales. Sample sale store_id: ${storeId}`);

  let calculatedRevenue = 0;
  let oldTotalCost = 0;
  let correctedTotalCost = 0;
  let itemsCount = 0;
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;
  let zeroCostItemsCount = 0;
  let positiveCostItemsCount = 0;
  let variablePriceItemsCount = 0;

  const unmatchedItems = [];
  const zeroCostItems = [];

  validSales.forEach(sale => {
    calculatedRevenue += sale.total || 0;

    sale.sale_items?.forEach(item => {
      itemsCount++;
      const product = productsMap.get(item.product_id);
      if (product) {
        matchedItemsCount++;
        const cost = product.cost || 0;
        
        // Old logic: always cost * quantity
        oldTotalCost += cost * (item.quantity || 0);

        if (cost > 0) {
          positiveCostItemsCount++;
          
          // Corrected logic: check if variable price
          if (product.is_variable_price) {
            variablePriceItemsCount++;
            // Cost is stored as percentage (e.g. 70 for 70%)
            // Let's calculate the cost as percentage of the item subtotal or total
            const itemRevenue = item.total || 0;
            const itemCost = (cost / 100) * itemRevenue;
            correctedTotalCost += itemCost;
          } else {
            // Normal product: cost is absolute monetary value per unit
            correctedTotalCost += cost * (item.quantity || 0);
          }
        } else {
          zeroCostItemsCount++;
          zeroCostItems.push({
            sale_id: sale.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity
          });
        }
      } else {
        unmatchedItemsCount++;
        unmatchedItems.push({
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product ? item.product.name : 'Unknown',
          quantity: item.quantity,
          subtotal: item.subtotal
        });
      }
    });
  });

  console.log('\n--- ANALYSIS RESULTS ---');
  console.log(`Total Sales Revenue: $${calculatedRevenue.toFixed(2)}`);
  console.log(`Old Total Cost (frontend logic): $${oldTotalCost.toFixed(2)} (${(calculatedRevenue > 0 ? (oldTotalCost / calculatedRevenue) * 100 : 0).toFixed(1)}% of revenue)`);
  console.log(`Corrected Total Cost (handling variable price): $${correctedTotalCost.toFixed(2)} (${(calculatedRevenue > 0 ? (correctedTotalCost / calculatedRevenue) * 100 : 0).toFixed(1)}% of revenue)`);
  
  const oldProfit = calculatedRevenue - oldTotalCost;
  const oldProfitPct = calculatedRevenue > 0 ? (oldProfit / calculatedRevenue) * 100 : 0;
  console.log(`Old Profit Margin: $${oldProfit.toFixed(2)} (${oldProfitPct.toFixed(1)}%)`);

  const correctedProfit = calculatedRevenue - correctedTotalCost;
  const correctedProfitPct = calculatedRevenue > 0 ? (correctedProfit / calculatedRevenue) * 100 : 0;
  console.log(`Corrected Profit Margin: $${correctedProfit.toFixed(2)} (${correctedProfitPct.toFixed(1)}%)`);
  
  console.log('\n--- ITEM MATCHING ---');
  console.log(`Total items sold: ${itemsCount}`);
  console.log(`Matched with products table: ${matchedItemsCount}`);
  console.log(`  - Variable price products sold: ${variablePriceItemsCount}`);
  console.log(`  - With positive cost: ${positiveCostItemsCount}`);
  console.log(`  - With zero/null cost: ${zeroCostItemsCount}`);
  console.log(`Unmatched with products table: ${unmatchedItemsCount}`);

  if (unmatchedItems.length > 0) {
    console.log('\n--- TOP 10 UNMATCHED ITEMS (treated as $0 cost) ---');
    unmatchedItems.slice(0, 10).forEach(item => {
      console.log(`  Sale ID: ${item.sale_id}, Name: ${item.product_name}, Qty: ${item.quantity}, Subtotal: $${item.subtotal}, Product ID: ${item.product_id}`);
    });
  }

  if (zeroCostItems.length > 0) {
    console.log('\n--- TOP 10 MATCHED BUT ZERO-COST ITEMS ---');
    zeroCostItems.slice(0, 10).forEach(item => {
      console.log(`  Sale ID: ${item.sale_id}, Name: ${item.product_name}, Qty: ${item.quantity}, Price: $${item.price}`);
    });
  }
}

run();
