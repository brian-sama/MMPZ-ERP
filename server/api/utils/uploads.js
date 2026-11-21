import fs from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

const MIME_EXTENSION_MAP = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

// Only these extensions may ever be written to disk (blocks .html/.svg/.js/.exe etc.).
const ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.webp',
]);

// Light content sniffing for binary formats so a mislabelled payload is rejected.
const hasValidSignature = (extension, buffer) => {
    const startsWith = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
    switch (extension) {
        case '.pdf': return startsWith(0x25, 0x50, 0x44, 0x46); // %PDF
        case '.png': return startsWith(0x89, 0x50, 0x4e, 0x47);
        case '.jpg':
        case '.jpeg': return startsWith(0xff, 0xd8, 0xff);
        case '.webp': return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
        case '.docx':
        case '.xlsx': return startsWith(0x50, 0x4b); // zip container
        default: return true; // .doc/.xls (legacy, often mislabelled exports), .csv, .txt
    }
};

// Resolve a stored "/uploads/..." path to an absolute path, refusing anything outside UPLOADS_ROOT.
const toSafeAbsolutePath = (publicPath) => {
    const relativePath = String(publicPath || '').replace(/^\/?uploads[\\/]/, '');
    if (!relativePath || relativePath.includes('\0')) return null;
    const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);
    const relative = path.relative(UPLOADS_ROOT, absolutePath);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return null;
    }
    return absolutePath;
};

const normalizeFileName = (value) =>
    String(value || 'file')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

const ensureDirectory = (relativeDir) => {
    const absoluteDir = path.join(UPLOADS_ROOT, relativeDir);
    if (!fs.existsSync(absoluteDir)) {
        fs.mkdirSync(absoluteDir, { recursive: true });
    }
    return absoluteDir;
};

const extractBase64Payload = (base64Data) => {
    const raw = String(base64Data || '').trim();
    if (!raw) {
        throw new Error('Missing file data');
    }

    const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
        return {
            mimeType: dataUrlMatch[1],
            payload: dataUrlMatch[2],
        };
    }

    return {
        mimeType: null,
        payload: raw,
    };
};

export const writeBase64Upload = ({
    base64Data,
    fileName,
    mimeType,
    subdirectory,
    prefix,
    allowedMimeTypes = [],
    maxBytes = 6 * 1024 * 1024,
}) => {
    const extracted = extractBase64Payload(base64Data);
    const effectiveMimeType = mimeType || extracted.mimeType || 'application/octet-stream';

    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(effectiveMimeType)) {
        throw new Error('Unsupported file type');
    }

    const buffer = Buffer.from(extracted.payload, 'base64');
    if (!buffer.length) {
        throw new Error('Uploaded file is empty');
    }
    if (buffer.length > maxBytes) {
        throw new Error(`File is too large. Max allowed size is ${Math.floor(maxBytes / (1024 * 1024))}MB`);
    }

    const sanitizedName = normalizeFileName(fileName);
    const requestedExtension = path.extname(sanitizedName).toLowerCase();
    const extension = requestedExtension || MIME_EXTENSION_MAP[effectiveMimeType] || '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error('Unsupported file type');
    }
    if (!hasValidSignature(extension, buffer)) {
        throw new Error('File content does not match its type');
    }
    const safePrefix = normalizeFileName(prefix || 'upload');
    const timestamp = Date.now();
    const randomValue = Math.round(Math.random() * 1e9);
    const finalName = `${safePrefix}-${timestamp}-${randomValue}${extension}`;
    const absoluteDir = ensureDirectory(subdirectory);
    const absolutePath = path.join(absoluteDir, finalName);

    fs.writeFileSync(absolutePath, buffer);

    const publicPath = path.posix.join('/uploads', subdirectory.replace(/\\/g, '/'), finalName);
    return {
        absolutePath,
        publicPath,
        fileName: finalName,
        mimeType: effectiveMimeType,
        size: buffer.length,
    };
};

export const removeUploadedFile = (publicPath) => {
    if (!publicPath) return;
    const absolutePath = toSafeAbsolutePath(publicPath);
    if (absolutePath && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};

export const resolveUploadedFilePath = (publicPath) => {
    if (!publicPath) return null;
    const absolutePath = toSafeAbsolutePath(publicPath);
    return absolutePath && fs.existsSync(absolutePath) ? absolutePath : null;
};

export const readUploadedFileAsDataUrl = (publicPath, mimeType = 'application/octet-stream') => {
    const absolutePath = resolveUploadedFilePath(publicPath);
    if (!absolutePath) return null;
    const fileBuffer = fs.readFileSync(absolutePath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
};

export const DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
