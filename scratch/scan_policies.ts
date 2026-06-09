import * as fs from 'fs';
import * as path from 'path';

const migrationsDir = 'c:/Users/Harold/Documents/Proyectos/Cobro App/Cobro App/supabase/migrations';

async function run() {
  const files = fs.readdirSync(migrationsDir).sort();
  console.log(`Scanning ${files.length} migration files...`);
  
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Search for POLICY on profiles
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      if (lower.includes('policy') && lower.includes('profiles')) {
        console.log(`[${file}:${idx + 1}]: ${line.trim()}`);
      }
    });
  }
}

run();
