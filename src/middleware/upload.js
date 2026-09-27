/**
 * CV uploads.
 *
 * Files are held in memory and forwarded as an email attachment, never written
 * to disk. The host rebuilds the application directory on every deploy, so a
 * file saved there would disappear without warning, and a cleaning company has
 * no reason to run a document store.
 */
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

/** What a CV actually arrives as. Anything else is refused. */
const ALLOWED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/plain',
]);

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED.has(file.mimetype)) {
      callback(AppError.badRequest('Attach the CV as PDF or Word'));
      return;
    }

    callback(null, true);
  },
});

/**
 * Accepts one optional file under the field name "cv".
 *
 * Multer reports its own errors through the error handler with codes rather
 * than messages, so the size limit is translated here into something a
 * customer can act on.
 */
export const uploadCv = (req, res, next) =>
  upload.single('cv')(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      next(AppError.badRequest('The file is larger than 5 MB'));
      return;
    }

    next(error);
  });
