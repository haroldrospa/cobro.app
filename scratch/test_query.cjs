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
  
  console.log('\nRunning useUserStore query...');
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      store_id,
      stores:store_id (
        id,
        store_code,
        store_name,
        slug,
        is_active,
        owner_id,
        store_settings (*)
      )
    `)
    .eq('id', userId)
    .maybeSingle();
    
  if (error) {
    console.error('Query Error:', error);
  } else {
    console.log('Query Result:', JSON.stringify(data, null, 2));
  }
}

run();
