import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import {
  idParamSchema,
  listQuerySchema,
  updateQuoteSchema,
} from '../../validation/admin.schemas.js';

export const adminQuotesRouter = Router();

const include = {
  customer: true,
  service: { include: { translations: { where: { locale: 'sv' } } } },
};

adminQuotesRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status, search, page, perPage } = req.query;

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search } },
              { customer: { is: { name: { contains: search } } } },
              { customer: { is: { phone: { contains: search } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.quote.count({ where }),
    ]);

    res.json({ data: items, meta: { total, page, perPage } });
  }),
);

adminQuotesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateQuoteSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.quote.findUnique({ where: { id: req.params.id } });

    if (!existing) throw AppError.notFound('Quote not found');

    const { quotedAmount, ...rest } = req.body;

    const quote = await prisma.quote.update({
      where: { id: existing.id },
      // Staff type kronor; everything is stored in ore.
      data: {
        ...rest,
        ...(quotedAmount === undefined
          ? {}
          : { quotedAmount: quotedAmount === null ? null : quotedAmount * 100 }),
      },
      include,
    });

    res.json({ data: quote });
  }),
);
