// Run with: npm run test:uploads   (node --test tests/)
// Uses only Node built-ins + the already-installed express; no DB or env needed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {
    createUploadsRouter,
    createIntegrationFileHandler,
    normalizeRequestedPath,
} from '../server/api/utils/uploads-serve.js';

let tmp;
let root;
let server;
let base;

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-uploads-'));
    root = path.join(tmp, 'uploads');
    for (const dir of ['avatars', 'documents', 'vault', 'volunteer-submissions']) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(root, 'avatars', 'a.png'), PNG);
    fs.writeFileSync(path.join(root, 'avatars', 'evil.html'), '<script>1</script>');
    fs.writeFileSync(path.join(root, 'documents', 'd.docx'), 'PKdoc');
    fs.writeFileSync(path.join(root, 'documents', 'p.pdf'), '%PDF-1.4');
    fs.writeFileSync(path.join(root, 'vault', 'secret.pdf'), '%PDF-1.4 secret');
    fs.writeFileSync(path.join(root, 'volunteer-submissions', 'v.pdf'), '%PDF-1.4');
    fs.writeFileSync(path.join(tmp, 'outside-secret.txt'), 'TOP SECRET');

    const app = express();
    app.use(
        '/uploads',
        createUploadsRouter({
            uploadsRoot: root,
            authenticate: (req) => {
                const header = req.headers.authorization || '';
                if (header === 'Bearer user') return 1;
                if (header === 'Bearer admin') return 2;
                return null;
            },
            // user may read documents/*, admin may read everything
            authorize: ({ userId, relativePath }) =>
                userId === 2 || relativePath.startsWith('documents/'),
        }),
    );
    app.get(
        '/api/integration/files',
        createIntegrationFileHandler({
            uploadsRoot: root,
            allowedDirs: ['volunteer-submissions', 'documents'],
            verifyToken: (req) => req.headers['x-integration-token'] === 'tok',
        }),
    );
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
});

const get = (url, headers = {}) => fetch(`${base}${url}`, { headers, redirect: 'manual' });

test('avatars remain publicly reachable', async () => {
    const res = await get('/uploads/avatars/a.png');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('non-image file in avatars dir is not public', async () => {
    const res = await get('/uploads/avatars/evil.html');
    assert.equal(res.status, 401);
});

test('unauthenticated GET of a private file is 401', async () => {
    for (const url of ['/uploads/documents/d.docx', '/uploads/vault/secret.pdf', '/uploads/volunteer-submissions/v.pdf']) {
        const res = await get(url);
        assert.equal(res.status, 401, url);
    }
});

test('authenticated but unauthorized is 403 (fail closed)', async () => {
    const res = await get('/uploads/vault/secret.pdf', { Authorization: 'Bearer user' });
    assert.equal(res.status, 403);
});

test('authorized download carries hardened headers', async () => {
    const res = await get('/uploads/documents/d.docx', { Authorization: 'Bearer user' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('cache-control'), /private/);
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.match(res.headers.get('content-disposition'), /^attachment;/);

    const pdf = await get('/uploads/documents/p.pdf', { Authorization: 'Bearer user' });
    assert.match(pdf.headers.get('content-disposition'), /^inline;/);
});

test('path traversal is rejected, with or without auth', async () => {
    const attempts = [
        '/uploads/..%2foutside-secret.txt',
        '/uploads/%2e%2e/outside-secret.txt',
        '/uploads/documents/..%2f..%2foutside-secret.txt',
        '/uploads/documents/%2e%2e%2f%2e%2e%2foutside-secret.txt',
        '/uploads/documents/..%5c..%5coutside-secret.txt',
        '/uploads/avatars/..%2fvault%2fsecret.pdf',
        '/uploads/documents/a%00.pdf',
        '/uploads/documents/%ZZ',
    ];
    for (const url of attempts) {
        for (const headers of [{}, { Authorization: 'Bearer admin' }]) {
            const res = await get(url, headers);
            const text = await res.text();
            assert.ok([400, 404].includes(res.status), `${url} -> ${res.status}`);
            assert.ok(!text.includes('TOP SECRET'));
            assert.ok(!text.includes(tmp), 'must not reflect internal paths');
        }
    }
});

test('missing files return 404 and never redirect to another app', async () => {
    for (const [url, headers] of [
        ['/uploads/avatars/missing.png', {}],
        ['/uploads/documents/missing.pdf', { Authorization: 'Bearer admin' }],
    ]) {
        const res = await get(url, headers);
        assert.equal(res.status, 404, url);
        assert.equal(res.headers.get('location'), null);
    }
});

test('symlink escaping the uploads root is rejected', async (t) => {
    const link = path.join(root, 'documents', 'link.txt');
    try {
        fs.symlinkSync(path.join(tmp, 'outside-secret.txt'), link);
    } catch {
        t.skip('symlinks not permitted on this system');
        return;
    }
    const res = await get('/uploads/documents/link.txt', { Authorization: 'Bearer admin' });
    assert.ok([400, 404].includes(res.status));
    assert.ok(!(await res.text()).includes('TOP SECRET'));
});

test('integration file endpoint: token required, vault excluded, traversal rejected', async () => {
    assert.equal((await get('/api/integration/files?path=/uploads/documents/d.docx')).status, 401);
    const ok = await get('/api/integration/files?path=/uploads/documents/d.docx', { 'X-Integration-Token': 'tok' });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    const vault = await get('/api/integration/files?path=/uploads/vault/secret.pdf', { 'X-Integration-Token': 'tok' });
    assert.equal(vault.status, 403);
    const trav = await get('/api/integration/files?path=/uploads/documents/../../outside-secret.txt', { 'X-Integration-Token': 'tok' });
    assert.equal(trav.status, 400);
});

test('normalizeRequestedPath', () => {
    assert.equal(normalizeRequestedPath('/avatars/a.png'), 'avatars/a.png');
    assert.throws(() => normalizeRequestedPath('/a/../b'));
    assert.throws(() => normalizeRequestedPath('/a%00b'));
    assert.throws(() => normalizeRequestedPath('/a%5cb'));
});

test('uploads.js rejects unsafe extensions and does not delete outside the root', async () => {
    const cwd = process.cwd();
    process.chdir(tmp);
    try {
        const { writeBase64Upload, removeUploadedFile, resolveUploadedFilePath } = await import(
            '../server/api/utils/uploads.js'
        );
        const b64 = Buffer.from('<html></html>').toString('base64');
        assert.throws(
            () => writeBase64Upload({ base64Data: b64, fileName: 'x.html', mimeType: 'text/plain', subdirectory: 'documents', prefix: 'p' }),
            /Unsupported file type/,
        );
        assert.throws(
            () => writeBase64Upload({ base64Data: b64, fileName: 'x.pdf', mimeType: 'application/pdf', subdirectory: 'documents', prefix: 'p' }),
            /does not match/,
        );
        const csv = writeBase64Upload({
            base64Data: Buffer.from('a,b\n1,2').toString('base64'),
            fileName: 'x.csv', mimeType: 'text/csv', subdirectory: 'documents', prefix: 'p',
        });
        assert.ok(csv.publicPath.endsWith('.csv'));

        removeUploadedFile('/uploads/../outside-secret.txt');
        assert.ok(fs.existsSync(path.join(tmp, 'outside-secret.txt')));
        assert.equal(resolveUploadedFilePath('/uploads/../outside-secret.txt'), null);
    } finally {
        process.chdir(cwd);
    }
});
