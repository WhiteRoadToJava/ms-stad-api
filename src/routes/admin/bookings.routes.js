import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import {
  assignmentsSchema,
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
  assignments: { include: { employee: true } },
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

/**
 * Sets who is going to a booking, replacing whoever was on it.
 *
 * Sending the whole list rather than adding and removing one at a time keeps
 * the dashboard simple and makes the request idempotent: pressing save twice
 * leaves the same three people on the job.
 */
adminBookingsRouter.put(
  '/:id/assignments',
  validate({ params: idParamSchema, body: assignmentsSchema }),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking) throw AppError.notFound('Booking not found');

    const employeeIds = [...new Set(req.body.employeeIds)];

    if (employeeIds.length > 0) {
      const found = await prisma.employee.count({
        where: { id: { in: employeeIds }, isActive: true },
      });

      // An inactive or unknown id would create an assignment nobody can see in
      // the dashboard, so the whole request is refused instead.
      if (found !== employeeIds.length) {
        throw AppError.badRequest('One of the employees does not exist or has left');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.bookingAssignment.deleteMany({ where: { bookingId: booking.id } });

      if (employeeIds.length > 0) {
        await tx.bookingAssignment.createMany({
          data: employeeIds.map((employeeId) => ({ bookingId: booking.id, employeeId })),
        });
      }

      return tx.booking.findUnique({ where: { id: booking.id }, include });
    });

    res.json({ data: updated });
  }),
);
