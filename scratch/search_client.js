import fs from 'fs';
import path from 'path';

const searchDir = './client/src';
const queries = ['My Portal', 'Facilitator Workspace', 'Youth Facilitator / Peer Educator'];

function search(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            continue;
        }
        if (stat.isDirectory()) {
            search(fullPath);
        } else if (stat.isFile()) {
            if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.css')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    for (const q of queries) {
                        if (content.includes(q)) {
                            console.log(`Found "${q}" in: ${fullPath}`);
                        }
                    }
                } catch (e) {}
            }
        }
    }
}

console.log('Searching client/src...');
search(searchDir);
