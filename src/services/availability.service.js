/**
 * Bookable days.
 *
 * A day has a capacity, which is how many cleanings fit in it. The booking
 * form shows only days with room left, and the reservation happens inside the
 * booking transaction, so two people clicking at the same second cannot both
 * take the last place.
 *
 * This replaced three fixed windows per day. Customers were choosing between
 * 08:00-12:00 and 12:00-16:00 as if those were promises, when the hour is
 * actually agreed on the phone. A date is the honest question to ask.
 */
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
  DEFAULT_DAY_CAPACITY,
  OPEN_DAYS_AHEAD,
  OPEN_WEEKDAYS,
} from '../config/pricing.js';

/** Where the last top-up is recorded, so it runs once a day and not per visit. */
const LAST_ENSURED_KEY = 'days.lastEnsuredAt';

/** Midnight UTC, matching how @db.Date columns are stored. */
export const toDateOnly = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

/** Days a customer can still book. */
export const listAvailability = async ({ from, to } = {}) => {
  const start = toDateOnly(from ?? Date.now());
  const end = to ? toDateOnly(to) : addDays(start, OPEN_DAYS_AHEAD);

  const days = await prisma.availabilityDay.findMany({
    where: { date: { gte: start, lte: end }, isBlocked: false },
    orderBy: { date: 'asc' },
  });

  return days
    .filter((day) => day.bookedCount < day.capacity)
    .map((day) => ({
      date: day.date.toISOString().slice(0, 10),
      placesLeft: day.capacity - day.bookedCount,
    }));
};

/**
 * Takes one place on a day.
 *
 * Prisma cannot compare two columns in a where clause, so the count read a
 * moment ago acts as an optimistic lock: if another booking incremented it in
 * between, the update matches no rows and we fail instead of double booking.
 */
export const reserveDay = async (tx, date) => {
  const day = toDateOnly(date);

  const record = await tx.availabilityDay.findUnique({ where: { date: day } });

  if (!record) throw AppError.conflict('That date is not open for booking');
  if (record.isBlocked) throw AppError.conflict('That date is not available');
  if (record.bookedCount >= record.capacity) {
    throw AppError.conflict('That date was just booked by someone else');
  }

  const updated = await tx.availabilityDay.updateMany({
    where: { id: record.id, bookedCount: record.bookedCount },
    data: { bookedCount: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw AppError.conflict('That date was just booked by someone else');
  }

  return record;
};

/** Gives a place back when a booking is cancelled. */
export const releaseDay = async (tx, date) => {
  if (!date) return;

  await tx.availabilityDay.updateMany({
    where: { date: toDateOnly(date), bookedCount: { gt: 0 } },
    data: { bookedCount: { decrement: 1 } },
  });
};

/**
 * Opens days in a range. Repeatable: days that already exist, and the bookings
 * on them, are left untouched.
 */
export const openDays = async ({
  from,
  to,
  capacity = DEFAULT_DAY_CAPACITY,
  weekdays = OPEN_WEEKDAYS,
}) => {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  if (end < start) throw AppError.badRequest('The end date is before the start date');

  const rows = [];

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (!weekdays.includes(day.getUTCDay())) continue;
    rows.push({ date: new Date(day), capacity });
  }

  const result = await prisma.availabilityDay.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { created: result.count, considered: rows.length };
};

/**
 * Keeps the calendar open a fixed number of days ahead.
 *
 * Without this the last opened day would simply arrive one morning and the
 * booking form would show an empty calendar, with nobody noticing until the
 * enquiries stopped. Runs at most once a day: the host restarts the app
 * constantly and there is no reason to repeat the work per cold start.
 */
export const ensureUpcomingDays = async () => {
  const today = toDateOnly(Date.now());

  const marker = await prisma.setting.findUnique({ where: { key: LAST_ENSURED_KEY } });

  if (marker?.value === today.toISOString()) return null;

  const result = await openDays({
    from: addDays(today, 1),
    to: addDays(today, OPEN_DAYS_AHEAD),
  });

  await prisma.setting.upsert({
    where: { key: LAST_ENSURED_KEY },
    update: { value: today.toISOString() },
    create: { key: LAST_ENSURED_KEY, value: today.toISOString() },
  });

  if (result.created > 0) {
    console.log(`[days] opened ${result.created} new days`);
  }

  return result;
};

/**
 * Changes capacity or closes a range, for holidays, a week off, or a period
 * worked with extra staff.
 *
 * Capacity is never lowered below the bookings a day already carries: those
 * customers have a confirmed date, and the calendar must not forget them.
 */
export const updateDayRange = async ({ from, to, capacity, isBlocked, note }) => {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  if (end < start) throw AppError.badRequest('The end date is before the start date');

  const where = { date: { gte: start, lte: end } };

  if (isBlocked !== undefined) {
    await prisma.availabilityDay.updateMany({
      where,
      data: { isBlocked, ...(note === undefined ? {} : { note }) },
    });
  }

  if (capacity !== undefined) {
    const result = await prisma.availabilityDay.updateMany({
      where: { ...where, bookedCount: { lte: capacity } },
      data: { capacity },
    });

    const total = await prisma.availabilityDay.count({ where });

    return { updated: result.count, skipped: total - result.count };
  }

  const total = await prisma.availabilityDay.count({ where });
  return { updated: total, skipped: 0 };
};

/** Every day in a range, including full and closed ones, for the dashboard. */
export const listAllDays = async ({ from, to }) => {
  const start = toDateOnly(from ?? Date.now());
  const end = to ? toDateOnly(to) : addDays(start, 30);

  return prisma.availabilityDay.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });
};
