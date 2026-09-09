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
