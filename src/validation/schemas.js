/**
 * Request schemas.
 *
 * Everything arriving from a browser is parsed here before it reaches a
 * controller. Anything the customer could tamper with — above all prices — is
 * deliberately absent: the server recalculates it from the database.
 */
import { z } from 'zod';

const trimmed = (max) => z.string().trim().min(1).max(max);

/**
 * An optional text field that also accepts an empty string.
 *
 * A browser form sends "" for a field nobody filled in, not undefined, and
 * plain .optional() rejects it: the quote form failed for every customer
 * because it carried an empty city.
 */
const optionalText = (max) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    trimmed(max).optional(),
  );

/** Swedish postal codes are five digits, sometimes written "123 45". */
const postalCode = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{5}$/, 'Postal code must be five digits'));

export const customerSchema = z.object({
  name: trimmed(120),
  email: z.string().trim().email().max(160),
  phone: trimmed(40),
  street: optionalText(160),
  postalCode: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    postalCode.optional(),
  ),
  city: optionalText(80),
  isCompany: z.boolean().default(false),
  orgNumber: optionalText(20),
});

export const frequencySchema = z.enum(['ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);

/** Live price preview. Cheap, read only, no personal data. */
export const calculatePriceSchema = z.object({
  serviceSlug: trimmed(80),
  squareMeters: z.coerce.number().int().min(10).max(1000).optional(),
  hours: z.coerce.number().min(1).max(40).optional(),
  frequency: frequencySchema.default('ONCE'),
  extraKeys: z.array(trimmed(60)).max(10).default([]),
  applyRut: z.boolean().default(true),
});

export const bookingSchema = z.object({
  serviceSlug: trimmed(80),
  customer: customerSchema,
  squareMeters: z.coerce.number().int().min(10).max(1000).optional(),
  rooms: z.coerce.number().int().min(1).max(30).optional(),
  hours: z.coerce.number().min(1).max(40).optional(),
  frequency: frequencySchema.default('ONCE'),
  extraKeys: z.array(trimmed(60)).max(10).default([]),
  applyRut: z.boolean().default(true),
  timeSlotId: z.coerce.number().int().positive().optional(),
  /**
   * The total shown on screen, in ore. Not used to price anything: the server
   * recalculates and refuses the booking if the two disagree, so a customer is
   * never invoiced a figure they were not shown.
   */
  quotedTotal: z.coerce.number().int().min(0).optional(),
  floor: optionalText(20),
  hasElevator: z.boolean().optional(),
  hasPets: z.boolean().optional(),
  message: z.string().trim().max(2000).optional(),
  // Honeypot: a hidden field only a bot fills in.
  website: z.string().max(0).optional(),
});

export const quoteSchema = z.object({
  serviceSlug: optionalText(80),
  customer: customerSchema,
  propertyType: optionalText(60),
  squareMeters: z.coerce.number().int().min(1).max(100000).optional(),
  frequency: frequencySchema.optional(),
  description: z.string().trim().max(2000).optional(),
  website: z.string().max(0).optional(),
});

export const callbackSchema = z.object({
  name: optionalText(120),
  phone: trimmed(40),
  website: z.string().max(0).optional(),
});

export const availabilityQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const localeQuerySchema = z.object({
  locale: z.enum(['sv', 'en']).default('sv'),
});

export const slugParamsSchema = z.object({
  slug: trimmed(80),
});
