import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sql } from './utils/db.js';
import { getAuthenticatedUserId } from './utils/rbac.js';
import { getUserContext } from './utils/rbac.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(process.cwd(), 'uploads', 'avatars');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const isAllowed = allowedTypes.test(file.mimetype) || allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (isAllowed) return cb(null, true);
        cb(new Error('Only images (JPEG/PNG/WEBP) are allowed'));
    }
}).single('avatar');

export const handler = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            // Get user from authentication (assuming session token is passed in headers)
            // Note: Since multer is used, req.headers is available
            const authenticatedUserId = getAuthenticatedUserId({ headers: req.headers });
            if (!authenticatedUserId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const actor = await getUserContext(authenticatedUserId);
            const requestedTargetId = Number.parseInt(
                req.body?.targetUserId || req.body?.userId || '',
                10
            );
            const targetUserId =
                Number.isInteger(requestedTargetId) && requestedTargetId > 0
                    ? requestedTargetId
                    : authenticatedUserId;

            if (targetUserId !== authenticatedUserId && actor.system_role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only a System Admin can upload profile photos for other users' });
            }

            const avatarUrl = `/uploads/avatars/${req.file.filename}`;
            
            // Update database
            await sql`
                UPDATE users
                SET
                    profile_picture_url = ${avatarUrl},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${targetUserId}
            `;

            res.status(200).json({ 
                message: 'Avatar uploaded successfully',
                url: avatarUrl,
                userId: targetUserId
            });
        } catch (dbErr) {
            console.error('Error updating profile picture in DB:', dbErr);
            res.status(500).json({ error: 'Internal server error while updating profile' });
        }
    });
};
