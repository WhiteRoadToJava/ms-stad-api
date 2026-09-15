/**
 * Admin authentication.
 *
 * Two tokens: a short lived access token the browser keeps in memory, and a
 * long lived refresh token stored in an httpOnly cookie. The access token is
 * never written to localStorage, so a script injected into the page cannot
 * read it, and the refresh cookie cannot be read by JavaScript at all.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const REFRESH_COOKIE = 'ma_refresh';

const signAccessToken = (admin) =>
  jwt.sign({ sub: admin.id, role: admin.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });

const signRefreshToken = (admin) =>
  jwt.sign({ sub: admin.id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/admin/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const publicAdmin = (admin) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  mustChangePassword: admin.mustChangePassword,
});

export const login = async ({ email, password }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });

  // Compare against a dummy hash when the account is missing so a wrong email
  // and a wrong password take the same time to answer. Otherwise the response
  // time alone tells an attacker which addresses exist.
  const hash = admin?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const matches = await bcrypt.compare(password, hash);

  if (!admin || !admin.isActive || !matches) {
    throw AppError.unauthorized('Wrong email or password');
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    admin: publicAdmin(admin),
    accessToken: signAccessToken(admin),
    refreshToken: signRefreshToken(admin),
  };
};

export const refresh = async (token) => {
  if (!token) throw AppError.unauthorized('No refresh token');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw AppError.unauthorized('Refresh token is not valid');
  }

  const admin = await prisma.admin.findUnique({ where: { id: payload.sub } });

  if (!admin || !admin.isActive) throw AppError.unauthorized('Account is not active');

  return {
    admin: publicAdmin(admin),
    accessToken: signAccessToken(admin),
    refreshToken: signRefreshToken(admin),
  };
};

export const changePassword = async (adminId, { currentPassword, newPassword }) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });

  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw AppError.unauthorized('Current password is wrong');
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });
};
