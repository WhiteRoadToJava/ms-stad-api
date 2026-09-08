/**
 * Pricing rules.
 *
 * These are the parts of the price that are policy rather than catalogue data:
 * the tax deduction, how often the customer books, and how much of a service
 * counts as labour. Catalogue prices themselves live in the database so staff
 * can change them from the admin panel without a deploy.
 *
 * All amounts are in ore (1 SEK = 100 ore).
 */

/** RUT gives 50 % off the labour cost of household services in Sweden. */
export const RUT_RATE = 0.5;

/** Maximum RUT a person may use per calendar year: 75 000 kr. */
export const RUT_ANNUAL_CAP_ORE = 7_500_000;

/**
 * Share of a service price that is labour, and therefore the base the RUT
 * deduction is applied to. Cleaning is almost entirely labour because we bring
 * the materials; moving help includes vehicle and fuel, which do not qualify.
 */
export const LABOR_SHARE = {
  default: 1,
  flytthjalp: 0.6,
};

/**
 * A single visit costs more than a recurring one: travel, setup and admin are
 * paid for once instead of being spread over the year.
 */
export const FREQUENCY_MULTIPLIER = {
  ONCE: 1.35,
  MONTHLY: 1.1,
  BIWEEKLY: 1.0,
  WEEKLY: 0.95,
};

/** Minimum billable hours for hourly services. */
export const MIN_BILLABLE_HOURS = 2;

/** Bookable slots offered to customers, generated ahead by the seed script. */
export const TIME_SLOTS = [
  { startTime: '08:00', endTime: '12:00' },
  { startTime: '12:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '20:00' },
];

/** How many teams can work one slot before it is shown as fully booked. */
export const DEFAULT_SLOT_CAPACITY = 2;
