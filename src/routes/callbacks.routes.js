import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { formLimiter } from '../middleware/rateLimiters.js';
import { callbackSchema } from '../validation/schemas.js';
import { sendCallbackEmail } from '../services/mail.service.js';

export const callbacksRouter = Router();

/** "Leave your number and we call you" — the lowest effort way to get in touch. */
callbacksRouter.post(
  '/',
  formLimiter,
  validate({ body: callbackSchema }),
  asyncHandler(async (req, res) => {
    if (req.body.website) return res.status(201).json({ data: { ok: true } });

    const callback = await prisma.callbackRequest.create({
      data: { name: req.body.name, phone: req.body.phone },
    });

    sendCallbackEmail(callback).catch((error) =>
      console.error('[callbacks] email failed', callback.id, error),
    );

    res.status(201).json({ data: { ok: true } });
  }),
);
