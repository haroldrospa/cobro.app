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

  console.log('\nQuerying daily sales totals in the last 60 days...');
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, total, created_at, status')
    .eq('store_id', targetStoreId)
    .eq('status', 'completed');

  if (salesError) {
    console.error(salesError);
    return;
  }

  // Aggregate by day
  const dailyTotals = {};
  sales.forEach(sale => {
    const day = sale.created_at.split('T')[0];
    dailyTotals[day] = (dailyTotals[day] || 0) + (sale.total || 0);
  });

  console.log('Daily Totals (sorted by date):');
  Object.keys(dailyTotals).sort((a,b) => b.localeCompare(a)).slice(0, 30).forEach(day => {
    console.log(`  Date: ${day} | Total Sales: $${dailyTotals[day].toFixed(2)}`);
  });
}

run();
