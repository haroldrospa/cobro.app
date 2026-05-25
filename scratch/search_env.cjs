const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.gemini') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchDir(fullPath);
        } else if (stat.isFile()) {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('.focus()')) {
                    console.log(`Found in: ${fullPath}`);
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes('.focus()')) {
                            console.log(`  L${idx+1}: ${line.trim()}`);
                        }
                    });
                }
            }
        }
    }
}

searchDir('.');
