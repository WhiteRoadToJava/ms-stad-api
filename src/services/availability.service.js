/**
 * Bookable time slots.
 *
 * A slot has a capacity, which is how many teams can work it. The booking flow
 * shows only slots with room left, and the reservation itself happens inside
 * the booking transaction so two people clicking at the same second cannot
 * both take the last place.
 */
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
  DEFAULT_SLOT_CAPACITY,
  OPEN_SLOTS_DAYS,
  OPEN_SLOTS_WEEKDAYS,
  TIME_SLOTS,
} from '../config/pricing.js';

/** Where the last top-up is recorded, so it runs once a day and not per visit. */
const LAST_ENSURED_KEY = 'slots.lastEnsuredAt';

/** Midnight UTC, matching how @db.Date columns are stored. */
const toDateOnly = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const listAvailability = async ({ from, to } = {}) => {
  const start = toDateOnly(from ?? Date.now());
  const end = to ? toDateOnly(to) : new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);

  const slots = await prisma.timeSlot.findMany({
    where: { date: { gte: start, lte: end }, isBlocked: false },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return slots
    .filter((slot) => slot.bookedCount < slot.capacity)
    .map((slot) => ({
      id: slot.id,
      date: slot.date.toISOString().slice(0, 10),
      startTime: slot.startTime,
      endTime: slot.endTime,
      placesLeft: slot.capacity - slot.bookedCount,
    }));
};

/**
 * Takes one place in a slot.
 *
 * Prisma cannot compare two columns in a where clause, so the count read a
 * moment ago is used as an optimistic lock: if another booking incremented it
 * in between, the update matches zero rows and we fail instead of overbooking.
 */
export const reserveSlot = async (tx, timeSlotId) => {
  const slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });

  if (!slot) throw AppError.notFound('Time slot not found');
  if (slot.isBlocked) throw AppError.conflict('That time is not available');
  if (slot.bookedCount >= slot.capacity) {
    throw AppError.conflict('That time was just booked by someone else');
  }

  const updated = await tx.timeSlot.updateMany({
    where: { id: slot.id, bookedCount: slot.bookedCount },
    data: { bookedCount: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw AppError.conflict('That time was just booked by someone else');
  }

  return slot;
};

/**
 * Opens slots for a date range. Repeatable: existing slots, and the bookings
 * on them, are left untouched.
 */
export const openSlots = async ({
  from,
  to,
  capacity = DEFAULT_SLOT_CAPACITY,
  weekdays = OPEN_SLOTS_WEEKDAYS,
}) => {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  if (end < start) throw AppError.badRequest('The end date is before the start date');

  const rows = [];

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (!weekdays.includes(day.getUTCDay())) continue;

    for (const slot of TIME_SLOTS) {
      rows.push({ date: new Date(day), ...slot, capacity });
    }
  }

  const result = await prisma.timeSlot.createMany({ data: rows, skipDuplicates: true });

  return { created: result.count, considered: rows.length };
};

/**
 * Keeps the calendar open a fixed number of days ahead.
 *
 * The seed opened sixty days once. Without this the last of them would simply
 * arrive one day, and the booking form would show an empty calendar with
 * nobody noticing until the enquiries stopped.
 *
 * Runs at most once a day: the host restarts the app often, and there is no
 * reason to repeat the work on every cold start.
 */
export const ensureUpcomingSlots = async () => {
  const today = toDateOnly(Date.now());

  const marker = await prisma.setting.findUnique({ where: { key: LAST_ENSURED_KEY } });

  if (marker?.value === today.toISOString()) return null;

  const result = await openSlots({
    from: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    to: new Date(today.getTime() + OPEN_SLOTS_DAYS * 24 * 60 * 60 * 1000),
  });

  await prisma.setting.upsert({
    where: { key: LAST_ENSURED_KEY },
    update: { value: today.toISOString() },
    create: { key: LAST_ENSURED_KEY, value: today.toISOString() },
  });

  if (result.created > 0) {
    console.log(`[slots] opened ${result.created} new slots for the coming days`);
  }

  return result;
};

/**
 * Changes capacity or blocks a whole date range, for holidays, a week off, or
 * a period with extra staff.
 *
 * Capacity is never lowered below the bookings a slot already carries: those
 * customers have a confirmed time, and the calendar must not forget them.
 */
export const updateSlotRange = async ({ from, to, capacity, isBlocked }) => {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  if (end < start) throw AppError.badRequest('The end date is before the start date');

  const where = { date: { gte: start, lte: end } };

  if (isBlocked !== undefined) {
    await prisma.timeSlot.updateMany({ where, data: { isBlocked } });
  }

  if (capacity !== undefined) {
    const result = await prisma.timeSlot.updateMany({
      where: { ...where, bookedCount: { lte: capacity } },
      data: { capacity },
    });

    const total = await prisma.timeSlot.count({ where });

    return { updated: result.count, skipped: total - result.count };
  }

  const total = await prisma.timeSlot.count({ where });
  return { updated: total, skipped: 0 };
};

/** Every slot in a range, including full and blocked ones, for the dashboard. */
export const listAllSlots = async ({ from, to }) => {
  const start = toDateOnly(from ?? Date.now());
  const end = toDateOnly(to ?? Date.now() + 30 * 24 * 60 * 60 * 1000);

  return prisma.timeSlot.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
};
