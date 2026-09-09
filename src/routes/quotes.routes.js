import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { formLimiter } from '../middleware/rateLimiters.js';
import { quoteSchema } from '../validation/schemas.js';
import { createQuote } from '../services/booking.service.js';
import { sendQuoteEmails } from '../services/mail.service.js';

export const quotesRouter = Router();

/** For window cleaning, stairwells and everything priced after a walkthrough. */
quotesRouter.post(
  '/',
  formLimiter,
  validate({ body: quoteSchema }),
  asyncHandler(async (req, res) => {
    if (req.body.website) {
      return res.status(201).json({ data: { reference: 'OF-0000-0000' } });
    }

    const { quote, customer, service } = await createQuote(req.body);

    sendQuoteEmails({
      quote,
      customer,
      serviceName: service?.translations?.[0]?.name ?? service?.slug,
    }).catch((error) => console.error('[quotes] email failed', quote.reference, error));

    res.status(201).json({ data: { reference: quote.reference } });
  }),
);
