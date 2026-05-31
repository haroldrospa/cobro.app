const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Fetching open cash sessions...');
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('id, opened_at, opened_by, status, closed_at')
    .eq('status', 'open');
    
  if (error) {
    console.error('Error fetching cash sessions:', error);
  } else {
    console.log(`Found ${data.length} open sessions:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
