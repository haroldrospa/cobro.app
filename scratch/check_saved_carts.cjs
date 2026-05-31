const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Fetching all records from saved_carts table...');
  const { data, error } = await supabase
    .from('saved_carts')
    .select('*');

  if (error) {
    console.error('Error fetching saved_carts:', error);
  } else {
    console.log(`Found ${data.length} saved carts:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
