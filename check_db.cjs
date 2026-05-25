const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Checking cash_movements table...');
  const { data, error } = await supabase.from('cash_movements').select('*').limit(1);
  if (error) {
    console.error('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success. Data:', data);
  }
}

check();
