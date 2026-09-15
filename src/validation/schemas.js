/**
 * Request schemas.
 *
 * Everything arriving from a browser is parsed here before it reaches a
 * controller. Anything the customer could tamper with — above all prices — is
 * deliberately absent: the server recalculates it from the database.
 */
import { z } from 'zod';

const trimmed = (max) => z.string().trim().min(1).max(max);

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
  street: trimmed(160).optional(),
  postalCode: postalCode.optional(),
  city: trimmed(80).optional(),
  isCompany: z.boolean().default(false),
  orgNumber: trimmed(20).optional(),
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
  floor: trimmed(20).optional(),
  hasElevator: z.boolean().optional(),
  hasPets: z.boolean().optional(),
  message: z.string().trim().max(2000).optional(),
  // Honeypot: a hidden field only a bot fills in.
  website: z.string().max(0).optional(),
});

export const quoteSchema = z.object({
  serviceSlug: trimmed(80).optional(),
  customer: customerSchema,
  propertyType: trimmed(60).optional(),
  squareMeters: z.coerce.number().int().min(1).max(100000).optional(),
  frequency: frequencySchema.optional(),
  description: z.string().trim().max(2000).optional(),
  website: z.string().max(0).optional(),
});

export const callbackSchema = z.object({
  name: trimmed(120).optional(),
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
