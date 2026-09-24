import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../config/prisma.js';
import {
  listAllSlots,
  openSlots,
  updateSlotRange,
} from '../../services/availability.service.js';
import {
  createSlotsSchema,
  idParamSchema,
  listQuerySchema,
  updateSlotRangeSchema,
  updateSlotSchema,
} from '../../validation/admin.schemas.js';

export const adminAvailabilityRouter = Router();

/** Every slot in a range, including full and blocked ones the public never sees. */
adminAvailabilityRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const slots = await listAllSlots({ from: req.query.from, to: req.query.to });
    res.json({ data: slots });
  }),
);

/**
 * Opens slots for a date range. The server keeps sixty days open by itself;
 * this is for opening a period earlier, or reopening one that was blocked.
 */
adminAvailabilityRouter.post(
  '/',
  validate({ body: createSlotsSchema }),
  asyncHandler(async (req, res) => {
    const result = await openSlots(req.body);
    res.status(201).json({ data: result });
  }),
);

/** Holidays, a week off, or a period worked with extra staff. */
adminAvailabilityRouter.patch(
  '/range',
  validate({ body: updateSlotRangeSchema }),
  asyncHandler(async (req, res) => {
    const result = await updateSlotRange(req.body);
    res.json({ data: result });
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
