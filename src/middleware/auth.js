import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** Rejects anything without a valid access token in the Authorization header. */
export const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized('Missing access token'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.admin = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(AppError.unauthorized('Access token is not valid or has expired'));
  }
};

/**
 * Role check for the endpoints that change money or availability. Staff can
 * work with bookings; only an admin edits the price list.
 */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.admin) return next(AppError.unauthorized());
    if (!roles.includes(req.admin.role)) {
      return next(AppError.forbidden('Your account may not do that'));
    }
    return next();
  };
