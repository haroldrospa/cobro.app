const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Fetching profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*');
    
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log(`Found ${data.length} profiles:`);
    console.log(JSON.stringify(data.map(p => ({ id: p.id, full_name: p.full_name, email: p.email, role: p.role, store_id: p.store_id })), null, 2));
  }
}

check();
