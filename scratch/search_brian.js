import fs from 'fs';
import path from 'path';

const searchDirs = ['.', '../mmpz-compass-main', '../mmpz_compass_mobile'];
const query = 'Dumolwenkosi';

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
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.toLowerCase().includes(query.toLowerCase())) {
                    console.log(`Found in: ${fullPath}`);
                }
            } catch (e) {}
        }
    }
}

for (const d of searchDirs) {
    console.log(`Searching directory: ${d}`);
    search(d);
}
