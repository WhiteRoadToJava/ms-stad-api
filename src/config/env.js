/**
 * Environment configuration.
 * Every variable is validated once at startup so the app fails fast with a
 * readable message instead of throwing "undefined" errors at request time.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromString = z.string().transform((value) => value.toLowerCase() === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET is too short'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET is too short'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: booleanFromString.default('true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('MA Stad <info@mastad.se>'),
  MAIL_TO_INTERNAL: z.string().default('info@mastad.se'),

  RUT_PERCENTAGE: z.coerce.number().min(0).max(100).default(50),
  RUT_ANNUAL_CAP: z.coerce.number().int().default(75000),
  VAT_PERCENTAGE: z.coerce.number().min(0).max(100).default(25),
  PUBLIC_SITE_URL: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  // "a.com, b.com" -> ["a.com", "b.com"]
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
