import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validate } from '../middleware/validate.js';
import { localeQuerySchema, slugParamsSchema } from '../validation/schemas.js';

export const servicesRouter = Router();

/** Flattens one translation into the service, so clients get a single object. */
const present = (service) => {
  const [translation] = service.translations;

  return {
    slug: service.slug,
    category: service.category,
    pricingModel: service.pricingModel,
    pricePerSqm: service.pricePerSqm,
    minPrice: service.minPrice,
    hourlyRate: service.hourlyRate,
    packagePrice: service.packagePrice,
    rutEligible: service.rutEligible,
    isPopular: service.isPopular,
    name: translation?.name ?? service.slug,
    shortDescription: translation?.shortDescription ?? '',
    longDescription: translation?.longDescription ?? null,
    includes: translation?.includes ?? [],
    extras:
      service.extras?.map((extra) => ({
        key: extra.key,
        price: extra.price,
        name: extra.nameSv,
      })) ?? [],
  };
};

servicesRouter.get(
  '/',
  validate({ query: localeQuerySchema }),
  asyncHandler(async (req, res) => {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: { where: { locale: req.query.locale } },
        extras: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    res.json({ data: services.map(present) });
  }),
);

servicesRouter.get(
  '/:slug',
  validate({ params: slugParamsSchema, query: localeQuerySchema }),
  asyncHandler(async (req, res) => {
    const service = await prisma.service.findFirst({
      where: { slug: req.params.slug, isActive: true },
      include: {
        translations: { where: { locale: req.query.locale } },
        extras: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!service) throw AppError.notFound('Service not found');

    res.json({ data: present(service) });
  }),
);
