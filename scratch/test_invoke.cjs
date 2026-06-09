const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const url = `${env.VITE_SUPABASE_URL}/functions/v1/send-daily-report`;
const key = env.VITE_SUPABASE_KEY;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, key);

async function run() {
  console.log('Fetching a store_id...');
  const storeId = '026721e8-b488-4796-a431-b12b540b4e4d';
  console.log('Using Store ID:', storeId);

  const payload = {
    store_id: storeId,
    recipient_email: 'haroldrospa@gmail.com',
    report_type: 'daily'
  };

  console.log('Invoking Edge Function at:', url);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    const text = await response.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
