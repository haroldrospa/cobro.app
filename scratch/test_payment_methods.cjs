const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: sales, error } = await supabase
    .from('sales')
    .select('id, payment_method, total, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching sales:", error);
    return;
  }

  console.log("LAST 20 SALES:");
  sales.forEach(sale => {
    console.log(`ID: ${sale.id} | Date: ${sale.created_at} | Method: ${sale.payment_method} | Total: ${sale.total}`);
  });

  // Unique payment methods
  const { data: allMethods, error: methodsError } = await supabase
    .from('sales')
    .select('payment_method');

  if (methodsError) {
    console.error("Error fetching all payment methods:", methodsError);
  } else {
    const uniqueMethods = [...new Set(allMethods.map(s => s.payment_method))];
    console.log("\nUNIQUE PAYMENT METHODS IN DATABASE:", uniqueMethods);
  }
}

run();
