import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimiters.js';
import { loginSchema, changePasswordSchema } from '../../validation/admin.schemas.js';
import {
  REFRESH_COOKIE,
  changePassword,
  login,
  refresh,
  refreshCookieOptions,
} from '../../services/auth.service.js';

export const adminAuthRouter = Router();

adminAuthRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { admin, accessToken, refreshToken } = await login(req.body);

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ data: { admin, accessToken } });
  }),
);

/** Called when the short lived access token expires, using the cookie alone. */
adminAuthRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { admin, accessToken, refreshToken } = await refresh(
      req.cookies?.[REFRESH_COOKIE],
    );

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ data: { admin, accessToken } });
  }),
);

adminAuthRouter.post('/logout', (req, res) => {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ data: { ok: true } });
});

adminAuthRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, email: true, name: true, role: true, mustChangePassword: true },
    });

    res.json({ data: admin });
  }),
);

adminAuthRouter.post(
  '/password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await changePassword(req.admin.id, req.body);
    res.json({ data: { ok: true } });
  }),
);
