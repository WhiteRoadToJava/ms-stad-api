import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import {
  listAllDays,
  openDays,
  updateDayRange,
} from '../../services/availability.service.js';
import {
  createDaysSchema,
  idParamSchema,
  listQuerySchema,
  updateDayRangeSchema,
  updateDaySchema,
} from '../../validation/admin.schemas.js';

export const adminAvailabilityRouter = Router();

/** Every day in a range, including full and closed ones the public never sees. */
adminAvailabilityRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const days = await listAllDays({ from: req.query.from, to: req.query.to });
    res.json({ data: days });
  }),
);

/**
 * Opens days in a range. The server keeps sixty days open by itself; this is
 * for opening a period earlier, or reopening one that was closed.
 */
adminAvailabilityRouter.post(
  '/',
  validate({ body: createDaysSchema }),
  asyncHandler(async (req, res) => {
    const result = await openDays(req.body);
    res.status(201).json({ data: result });
  }),
);

/** Holidays, a week off, or a period worked with extra staff. */
adminAvailabilityRouter.patch(
  '/range',
  validate({ body: updateDayRangeSchema }),
  asyncHandler(async (req, res) => {
    const result = await updateDayRange(req.body);
    res.json({ data: result });
  }),
);

adminAvailabilityRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateDaySchema }),
  asyncHandler(async (req, res) => {
    const day = await prisma.availabilityDay.findUnique({ where: { id: req.params.id } });

    if (!day) throw AppError.notFound('Day not found');

    if (req.body.capacity !== undefined && req.body.capacity < day.bookedCount) {
      throw AppError.conflict('Capacity cannot be lower than the bookings already taken');
    }

    const updated = await prisma.availabilityDay.update({
      where: { id: day.id },
      data: req.body,
    });

    res.json({ data: updated });
  }),
);
