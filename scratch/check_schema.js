const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Querying one record from sale_items to see columns...');
  const { data, error } = await supabase.from('sale_items').select('*').limit(1);
  if (error) {
    console.error('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success. Data keys:', data.length > 0 ? Object.keys(data[0]) : 'No data found');
  }
}

check();
