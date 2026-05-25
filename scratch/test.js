import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.resolve('.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('cash_sessions')
    .select('id, opened_by, opened_at, status, store_id, opener:opened_by(full_name, role)')
    .limit(1)
    .then(({ data, error }) => {
      console.log('DATA:', JSON.stringify(data, null, 2));
      console.log('ERROR:', error);
    });
} else {
  console.log('Env not found');
}
