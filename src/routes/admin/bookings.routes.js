import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import {
  idParamSchema,
  listQuerySchema,
  updateBookingSchema,
} from '../../validation/admin.schemas.js';

export const adminBookingsRouter = Router();

const include = {
  customer: true,
  service: { include: { translations: { where: { locale: 'sv' } } } },
  timeSlot: true,
  extras: true,
};

adminBookingsRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status, from, to, search, page, perPage } = req.query;

    const where = {
      ...(status ? { status } : {}),
      ...(from || to
        ? { scheduledDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      // One box that searches the three things staff actually have in front of
      // them when a customer calls: a reference, a name or a phone number.
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
      prisma.booking.findMany({
        where,
        include,
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({ data: items, meta: { total, page, perPage } });
  }),
);

adminBookingsRouter.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include,
    });

    if (!booking) throw AppError.notFound('Booking not found');

    res.json({ data: booking });
  }),
);

adminBookingsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateBookingSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!existing) throw AppError.notFound('Booking not found');

    const booking = await prisma.$transaction(async (tx) => {
      // Cancelling frees the slot again. Without this the day slowly fills up
      // with places nobody is coming to.
      if (
        req.body.status === 'CANCELLED' &&
        existing.status !== 'CANCELLED' &&
        existing.timeSlotId
      ) {
        await tx.timeSlot.updateMany({
          where: { id: existing.timeSlotId, bookedCount: { gt: 0 } },
          data: { bookedCount: { decrement: 1 } },
        });
      }

      return tx.booking.update({ where: { id: existing.id }, data: req.body, include });
    });

    res.json({ data: booking });
  }),
);
