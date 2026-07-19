const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // 1. Read .env file
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found');
      return;
    }
    const envContent = fs.readFileSync(envPath, 'utf8');
    const supabaseUrlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
    const supabaseKeyMatch = envContent.match(/VITE_SUPABASE_KEY\s*=\s*(.*)/);
    
    if (!supabaseUrlMatch || !supabaseKeyMatch) {
      console.error('Failed to parse Supabase URL or Key from .env');
      return;
    }
    
    const supabaseUrl = supabaseUrlMatch[1].trim().replace(/['"]/g, '');
    const supabaseKey = supabaseKeyMatch[1].trim().replace(/['"]/g, '');
    
    console.log('Supabase URL:', supabaseUrl);
    
    // 2. Fetch store_settings from Supabase REST API
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/store_settings?select=ai_api_key`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!dbResponse.ok) {
      console.error('Failed to fetch from Supabase:', dbResponse.status, await dbResponse.text());
      return;
    }
    
    const data = await dbResponse.json();
    console.log('Records found in store_settings:', data.length);
    
    const keys = data.map(row => row.ai_api_key).filter(Boolean);
    if (keys.length === 0) {
      console.log('No active ai_api_key found in database.');
      return;
    }
    
    // 3. For each key, query Groq models
    for (const key of keys) {
      console.log('\nQuerying Groq with key:', key.slice(0, 10) + '...');
      const groqResponse = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });
      
      if (!groqResponse.ok) {
        console.error('Failed to fetch from Groq:', groqResponse.status, await groqResponse.text());
        continue;
      }
      
      const groqData = await groqResponse.json();
      console.log('Active models on Groq:');
      groqData.data.forEach(model => {
        console.log(`- ID: ${model.id} (Created by: ${model.owned_by || 'unknown'})`);
      });
    }
  } catch (error) {
    console.error('Error in script:', error);
  }
}

main();
