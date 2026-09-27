import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { formLimiter } from '../middleware/rateLimiters.js';
import { uploadCv } from '../middleware/upload.js';
import { applicationSchema } from '../validation/schemas.js';
import { sendApplicationEmail } from '../services/mail.service.js';

export const applicationsRouter = Router();

/**
 * Job applications.
 *
 * The record is saved without the file: only the file name is kept, and the
 * document itself is emailed to the office. Storing CVs would mean holding
 * personal data we have no system for deleting, and the privacy policy
 * promises we do not keep more than we need.
 *
 * uploadCv runs before validate because the form is multipart: the text fields
 * do not exist on req.body until multer has parsed it.
 */
applicationsRouter.post(
  '/',
  formLimiter,
  uploadCv,
  validate({ body: applicationSchema }),
  asyncHandler(async (req, res) => {
    if (req.body.website) return res.status(201).json({ data: { ok: true } });

    const application = await prisma.jobApplication.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        message: req.body.message,
        hasDriversLicense: req.body.hasDriversLicense,
        cvFileName: req.file?.originalname ?? null,
      },
    });

    sendApplicationEmail({ application, file: req.file }).catch((error) =>
      console.error('[applications] email failed', application.id, error),
    );

    res.status(201).json({ data: { ok: true } });
  }),
);
