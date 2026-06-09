const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = `test_user_${Date.now()}@example.com`;
  const password = 'password123';
  
  console.log(`Registering test user: ${email}...`);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Diagnostic User',
        company_name: 'Test Diagnostic Company',
        rnc: '123456789',
        plan_id: 'basic',
        shop_type: 'store',
        onboarding_completed: true
      }
    }
  });
  
  if (error) {
    console.error('Signup Error:', error);
  } else {
    console.log('Signup Successful!');
    console.log('User ID:', data.user.id);
    console.log('User metadata:', data.user.user_metadata);
    
    // Now check if profile was created
    console.log('\nChecking if profile was created for this user...');
    // Since RLS is active on profiles, we cannot select using the anon key.
    // But we can check if the store was created if there's no RLS or if we query stores.
    const { data: stores, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', data.user.id);
      
    if (storeError) {
      console.error('Error querying stores:', storeError);
    } else {
      console.log('Stores created:', stores);
    }
  }
}

run();
