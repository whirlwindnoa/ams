import fs from 'fs';
import path from 'path';
import multer from 'multer';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VENUE_UPLOAD_DIR = path.join(__dirname, '..', 'static', 'uploads', 'venues');

if (!fs.existsSync(VENUE_UPLOAD_DIR)) {
  fs.mkdirSync(VENUE_UPLOAD_DIR, { recursive: true });
}

export const venueUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, VENUE_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'venue_' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG/PNG/WEBP allowed'), ok);
  }
});