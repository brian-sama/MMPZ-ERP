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
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
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
    const requestedExtension = path.extname(sanitizedName);
    const extension = requestedExtension || MIME_EXTENSION_MAP[effectiveMimeType] || '';
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
    const relativePath = String(publicPath).replace(/^\/?uploads[\\/]/, '');
    const absolutePath = path.join(UPLOADS_ROOT, relativePath);
    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};

export const DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
