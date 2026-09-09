import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { formLimiter } from '../middleware/rateLimiters.js';
import { bookingSchema } from '../validation/schemas.js';
import { createBooking } from '../services/booking.service.js';
import { sendBookingEmails } from '../services/mail.service.js';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  formLimiter,
  validate({ body: bookingSchema }),
  asyncHandler(async (req, res) => {
    // A filled honeypot means a bot. Answer as if it worked so it stops
    // retrying, and write nothing.
    if (req.body.website) {
      return res.status(201).json({ data: { reference: 'MA-0000-0000' } });
    }

    const { booking, customer, service, timeSlot } = await createBooking(req.body);

    // Email is a side effect, not part of the booking. Awaiting it would make
    // a slow mail server look like a failed booking to the customer.
    sendBookingEmails({ booking, service, customer, timeSlot }).catch((error) =>
      console.error('[bookings] email failed', booking.reference, error),
    );

    res.status(201).json({
      data: {
        reference: booking.reference,
        scheduledDate: booking.scheduledDate,
        totalPrice: booking.totalPrice,
        rutDeduction: booking.rutDeduction,
      },
    });
  }),
);
