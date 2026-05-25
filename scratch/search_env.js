const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchDir(fullPath);
        } else if (stat.isFile()) {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.sql') || file.endsWith('.sh')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('VITE_SUPABASE_')) {
                    console.log(`Found in: ${fullPath}`);
                    // Print matching lines
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes('VITE_SUPABASE_')) {
                            console.log(`  L${idx+1}: ${line.trim()}`);
                        }
                    });
                }
            }
        }
    }
}

searchDir('.');
