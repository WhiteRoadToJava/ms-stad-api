import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validate } from '../middleware/validate.js';
import { calculatePriceSchema } from '../validation/schemas.js';
import { calculatePrice } from '../services/pricing.service.js';

export const pricingRouter = Router();

/**
 * The authoritative price.
 *
 * The browser calculates the same figure locally so the number moves as the
 * customer types, but this endpoint is what the booking is written from.
 */
pricingRouter.post(
  '/calculate',
  validate({ body: calculatePriceSchema }),
  asyncHandler(async (req, res) => {
    const service = await prisma.service.findFirst({
      where: { slug: req.body.serviceSlug, isActive: true },
      include: { extras: { where: { isActive: true } } },
    });

    if (!service) throw AppError.notFound('Service not found');

    const breakdown = calculatePrice({
      service,
      squareMeters: req.body.squareMeters,
      hours: req.body.hours,
      frequency: req.body.frequency,
      extraKeys: req.body.extraKeys,
      availableExtras: service.extras,
      applyRut: req.body.applyRut,
    });

    res.json({
      data: {
        ...breakdown,
        appliedExtras: breakdown.appliedExtras.map((extra) => ({
          key: extra.key,
          name: extra.nameSv,
          price: extra.price,
        })),
      },
    });
  }),
);
