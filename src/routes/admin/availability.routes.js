import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { TIME_SLOTS } from '../../config/pricing.js';
import {
  createSlotsSchema,
  idParamSchema,
  listQuerySchema,
  updateSlotSchema,
} from '../../validation/admin.schemas.js';

export const adminAvailabilityRouter = Router();

const toDateOnly = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/** Every slot in a range, including full and blocked ones the public never sees. */
adminAvailabilityRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const from = toDateOnly(req.query.from ?? Date.now());
    const to = toDateOnly(req.query.to ?? Date.now() + 30 * 24 * 60 * 60 * 1000);

    const slots = await prisma.timeSlot.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ data: slots });
  }),
);

/**
 * Opens slots for a date range. The seed only fills the first weeks, so
 * without this the calendar quietly runs out and nobody can book.
 */
adminAvailabilityRouter.post(
  '/',
  validate({ body: createSlotsSchema }),
  asyncHandler(async (req, res) => {
    const { capacity, weekdays } = req.body;
    const from = toDateOnly(req.body.from);
    const to = toDateOnly(req.body.to);

    if (to < from) throw AppError.badRequest('The end date is before the start date');

    const rows = [];

    for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
      if (!weekdays.includes(day.getUTCDay())) continue;

      for (const slot of TIME_SLOTS) {
        rows.push({ date: new Date(day), ...slot, capacity });
      }
    }

    // skipDuplicates keeps the call repeatable: running it again over a range
    // that is already open changes nothing instead of failing.
    const result = await prisma.timeSlot.createMany({ data: rows, skipDuplicates: true });

    res.status(201).json({ data: { created: result.count, considered: rows.length } });
  }),
);

adminAvailabilityRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateSlotSchema }),
  asyncHandler(async (req, res) => {
    const slot = await prisma.timeSlot.findUnique({ where: { id: req.params.id } });

    if (!slot) throw AppError.notFound('Time slot not found');

    if (req.body.capacity !== undefined && req.body.capacity < slot.bookedCount) {
      throw AppError.conflict('Capacity cannot be lower than the bookings already taken');
    }

    const updated = await prisma.timeSlot.update({
      where: { id: slot.id },
      data: req.body,
    });

    res.json({ data: updated });
  }),
);
