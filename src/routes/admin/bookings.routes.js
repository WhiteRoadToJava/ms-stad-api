import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { createBooking } from '../../services/booking.service.js';
import { sendBookingEmails } from '../../services/mail.service.js';
import {
  assignmentsSchema,
  createBookingSchema,
  idParamSchema,
  listQuerySchema,
  updateBookingSchema,
} from '../../validation/admin.schemas.js';

export const adminBookingsRouter = Router();

const include = {
  customer: true,
  service: { include: { translations: { where: { locale: 'sv' } } } },
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

    const { customer, customerScope, ...bookingFields } = req.body;

    const booking = await prisma.$transaction(async (tx) => {
      const cancelling =
        bookingFields.status === 'CANCELLED' && existing.status !== 'CANCELLED';

      // Cancelling frees the day again. Without this the calendar slowly fills
      // up with dates nobody is coming to.
      if (cancelling) await releaseDay(tx, existing.scheduledDate);

      // Moving a booking is two bookkeeping steps, not one: the old date gets
      // its place back and the new one gives a place up. Doing only the second
      // would leave the old day looking busy for a job that moved away.
      if (!cancelling && bookingFields.scheduledDate !== undefined) {
        const before = existing.scheduledDate?.toISOString().slice(0, 10) ?? null;
        const after = bookingFields.scheduledDate?.toISOString().slice(0, 10) ?? null;

        if (before !== after) {
          if (before) await releaseDay(tx, existing.scheduledDate);
          // Throws a 409 when the new date is full or closed, and the whole
          // transaction rolls back, so the old date is not lost either.
          if (after) await reserveDay(tx, bookingFields.scheduledDate);
        }
      }

      if (customer && Object.keys(customer).length > 0) {
        if (customerScope === 'booking') {
          // A correction belonging to this booking alone. The customer row is
          // shared, so the only way to leave the others untouched is a second
          // row, built from the first and then pointed at from here.
          const current = await tx.customer.findUnique({
            where: { id: existing.customerId },
          });

          const { id, createdAt, updatedAt, ...carried } = current;

          const replacement = await tx.customer.create({
            data: { ...carried, ...customer },
          });

          bookingFields.customerId = replacement.id;
        } else {
          // The number really did change: correcting it here corrects it on
          // every booking that person has made, which is what was meant.
          await tx.customer.update({ where: { id: existing.customerId }, data: customer });
        }
      }

      return tx.booking.update({
        where: { id: existing.id },
        data: bookingFields,
        include,
      });
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

/**
 * A booking taken over the phone.
 *
 * Most cleaning work is still booked by calling, and the office had nowhere to
 * put those: they were either lost or typed into the public form pretending to
 * be the customer.
 *
 * Separate from the public endpoint on purpose. There is no honeypot and no
 * check that the displayed price matches, because there is no page here to
 * have displayed one; instead staff may agree a price and decide whether a
 * confirmation email is sent at all, which a customer never could.
 */
adminBookingsRouter.post(
  '/',
  validate({ body: createBookingSchema }),
  asyncHandler(async (req, res) => {
    const { sendConfirmation, ...input } = req.body;

    const { booking, customer, service } = await createBooking({
      ...input,
      source: 'phone',
    });

    if (sendConfirmation) {
      sendBookingEmails({ booking, service, customer }).catch((error) =>
        console.error('[admin] booking email failed', booking.reference, error),
      );
    }

    const full = await prisma.booking.findUnique({ where: { id: booking.id }, include });

    res.status(201).json({ data: full });
  }),
);

/**
 * Removes a booking entered by mistake.
 *
 * Deliberately not the way to end a real booking: that is what CANCELLED is
 * for, and a cancelled booking still explains why a day was held and then
 * freed. This is for the row that should never have existed, typed against the
 * wrong customer or created twice by a double click.
 *
 * A completed booking is a record of work done and money owed, so it cannot be
 * removed at all. Admin only, since nothing brings it back.
 */
adminBookingsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!existing) throw AppError.notFound('Booking not found');

    if (existing.status === 'COMPLETED') {
      throw AppError.conflict(
        'A completed booking cannot be deleted. Cancel it instead if it was wrong.',
      );
    }

    await prisma.$transaction(async (tx) => {
      // The day it was holding goes back to the calendar, unless cancelling
      // had already given it back.
      if (existing.status !== 'CANCELLED') {
        await releaseDay(tx, existing.scheduledDate);
      }

      await tx.bookingAssignment.deleteMany({ where: { bookingId: existing.id } });
      await tx.bookingExtra.deleteMany({ where: { bookingId: existing.id } });
      await tx.booking.delete({ where: { id: existing.id } });
    });

    res.status(204).end();
  }),
);
