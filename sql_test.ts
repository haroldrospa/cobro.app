import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hkzgxdmnvyoviwketxva.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhremd4ZG1udnlvdml3a2V0eHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMjUzNzUsImV4cCI6MjA2NjgwMTM3NX0.roSANiwzCTmjsDCsVBnHg6c1mr1XKpWXpopFcDaIdrQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  const { data, error } = await supabase.from('categories').select('*').limit(10);
  console.log(JSON.stringify(data, null, 2))
}
run();
