const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Checking database tables...');
  
  console.log('\n--- PROFILES (Last 5) ---');
  const { data: profiles, error: errProfiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, store_id, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (errProfiles) {
    console.error('Error fetching profiles:', errProfiles);
  } else {
    console.log(profiles);
  }

  console.log('\n--- STORES (Last 5) ---');
  const { data: stores, error: errStores } = await supabase
    .from('stores')
    .select('id, store_name, store_code, owner_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (errStores) {
    console.error('Error fetching stores:', errStores);
  } else {
    console.log(stores);
  }

  console.log('\n--- STORE SETTINGS (Last 5) ---');
  const { data: settings, error: errSettings } = await supabase
    .from('store_settings')
    .select('id, store_id, shop_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (errSettings) {
    console.error('Error fetching store_settings:', errSettings);
  } else {
    console.log(settings);
  }
}

check();
