import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import { idParamSchema, updateServiceSchema } from '../../validation/admin.schemas.js';

export const adminServicesRouter = Router();

adminServicesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const services = await prisma.service.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: 'sv' } }, extras: true },
    });

    res.json({ data: services });
  }),
);

/**
 * Price changes are admin only, and they do not touch existing bookings:
 * every booking stores its own price snapshot, so raising a rate today never
 * rewrites what a customer already agreed to.
 */
adminServicesRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateServiceSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });

    if (!existing) throw AppError.notFound('Service not found');

    const service = await prisma.service.update({
      where: { id: existing.id },
      data: req.body,
      include: { translations: { where: { locale: 'sv' } } },
    });

    res.json({ data: service });
  }),
);
