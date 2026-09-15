import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import {
  idParamSchema,
  listQuerySchema,
  updateCallbackSchema,
} from '../../validation/admin.schemas.js';

export const adminCallbacksRouter = Router();

adminCallbacksRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, perPage } = req.query;

    const [items, total] = await Promise.all([
      prisma.callbackRequest.findMany({
        // Unhandled first: this list exists to be emptied.
        orderBy: [{ handled: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.callbackRequest.count(),
    ]);

    res.json({ data: items, meta: { total, page, perPage } });
  }),
);

adminCallbacksRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateCallbackSchema }),
  asyncHandler(async (req, res) => {
    const callback = await prisma.callbackRequest.update({
      where: { id: req.params.id },
      data: { handled: req.body.handled },
    });

    res.json({ data: callback });
  }),
);
