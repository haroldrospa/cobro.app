import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.resolve('.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split('\n');
let url = '', key = '';
for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, created_at, profile_id, user_id, total, status')
        .order('created_at', { ascending: false })
        .limit(10);
    
    console.log("Recent sales:", sales);
    
    const { data: sessions } = await supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(2);
        
    console.log("Recent sessions:", sessions);
}

check();
