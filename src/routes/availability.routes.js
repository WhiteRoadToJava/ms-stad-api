import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { availabilityQuerySchema } from '../validation/schemas.js';
import { listAvailability } from '../services/availability.service.js';

export const availabilityRouter = Router();

/** Slots the customer can still pick, 60 days ahead by default. */
availabilityRouter.get(
  '/',
  validate({ query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const slots = await listAvailability({ from: req.query.from, to: req.query.to });
    res.json({ data: slots });
  }),
);
