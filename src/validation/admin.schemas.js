/** Request schemas for the admin area. */
import { z } from 'zod';

const trimmed = (max) => z.string().trim().min(1).max(max);

/** Optional text that also accepts the empty string a blank input sends. */
const optionalText = (max) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    trimmed(max).optional(),
  );

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: trimmed(200),
});

export const changePasswordSchema = z.object({
  currentPassword: trimmed(200),
  // Long rather than complicated: length beats character classes, and the
  // office will otherwise write the clever one on a note by the screen.
  newPassword: z.string().min(12).max(200),
});

export const listQuerySchema = z.object({
  status: z.string().trim().max(20).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateBookingSchema = z
  .object({
    status: z.enum(['NEW', 'CONFIRMED', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
    internalNotes: z.string().trim().max(2000).nullable().optional(),
    scheduledDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const updateQuoteSchema = z
  .object({
    status: z.enum(['NEW', 'CONTACTED', 'SENT', 'WON', 'LOST']).optional(),
    // Kronor in, ore stored: staff type 2500, never 250000.
    quotedAmount: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const updateCallbackSchema = z.object({
  handled: z.boolean(),
});

export const updateServiceSchema = z
  .object({
    pricePerSqm: z.coerce.number().int().min(0).nullable().optional(),
    minPrice: z.coerce.number().int().min(0).nullable().optional(),
    hourlyRate: z.coerce.number().int().min(0).nullable().optional(),
    packagePrice: z.coerce.number().int().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
    isPopular: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const employeeSchema = z.object({
  name: trimmed(120),
  email: optionalText(160),
  phone: optionalText(40),
  // Hex colour, so a day's schedule can be read without reading every name.
  colour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value such as #124559')
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateEmployeeSchema = employeeSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/** The full set of people on a booking, replacing whoever was on it before. */
export const assignmentsSchema = z.object({
  employeeIds: z.array(z.coerce.number().int().positive()).max(10),
});

export const createDaysSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(20).default(1),
  /** 0 is Sunday, matching Date.getUTCDay(). Defaults to Monday-Saturday. */
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
});

export const updateDayRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    capacity: z.coerce.number().int().min(0).max(20).optional(),
    isBlocked: z.boolean().optional(),
    note: optionalText(200),
  })
  .refine(
    (value) => value.capacity !== undefined || value.isBlocked !== undefined,
    'Nothing to change',
  );

export const updateDaySchema = z
  .object({
    capacity: z.coerce.number().int().min(0).max(20).optional(),
    isBlocked: z.boolean().optional(),
    note: optionalText(200),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
