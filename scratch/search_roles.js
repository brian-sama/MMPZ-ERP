import fs from 'fs';
import path from 'path';

const searchDir = '.';
const query = 'DEVELOPMENT_FACILITATOR';

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            search(fullPath);
        } else if (stat.isFile()) {
            if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.html') || file.endsWith('.css')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes(query) || content.toLowerCase().includes('development facilitator')) {
                    console.log(`Found in: ${fullPath}`);
                }
            }
        }
    }
}

search(searchDir);
