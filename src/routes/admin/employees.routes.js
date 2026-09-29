import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import {
  employeeSchema,
  extraWorkSchema,
  idParamSchema,
  listQuerySchema,
  updateEmployeeSchema,
} from '../../validation/admin.schemas.js';

export const adminEmployeesRouter = Router();

const startOfToday = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/** Active first, then alphabetical: the working list, with leavers below it. */
adminEmployeesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const employees = await prisma.employee.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    res.json({ data: employees });
  }),
);

adminEmployeesRouter.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: employeeSchema }),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.create({ data: req.body });
    res.status(201).json({ data: employee });
  }),
);

/**
 * Employees are edited, never deleted. Setting isActive to false takes someone
 * out of the assignment lists while old bookings keep showing who actually
 * went, which is the whole point of recording it.
 */
adminEmployeesRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });

    if (!existing) throw AppError.notFound('Employee not found');

    const employee = await prisma.employee.update({
      where: { id: existing.id },
      data: req.body,
    });

    res.json({ data: employee });
  }),
);

/**
 * The jobs one person is on.
 *
 * Upcoming first, then what they have already done, because the question in
 * the office is usually "what is Anna doing on Thursday" rather than "what did
 * she do in March". Both are here; only the order takes a side.
 *
 * Cancelled bookings are included: someone asking why a day looks empty needs
 * to see that the job was called off, not that it never existed.
 */
adminEmployeesRouter.get(
  '/:id/bookings',
  validate({ params: idParamSchema, query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });

    if (!employee) throw AppError.notFound('Employee not found');

    const { page, perPage } = req.query;

    const where = { assignments: { some: { employeeId: employee.id } } };

    const [items, total, upcoming, thisMonth] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: true,
          service: { include: { translations: { where: { locale: 'sv' } } } },
        },
        // Nulls last in MySQL puts undated bookings after the dated ones,
        // which is where they belong: they are waiting for a date.
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.booking.count({ where }),
      prisma.booking.count({
        where: {
          ...where,
          scheduledDate: { gte: startOfToday() },
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
      }),
      prisma.booking.count({
        where: {
          ...where,
          scheduledDate: { gte: startOfMonth() },
          status: { not: 'CANCELLED' },
        },
      }),
    ]);

    // A count per month, from every job this person has, not just the page.
    // "How many did Anna do in October" is asked far more often than any
    // single booking on this list.
    const dated = await prisma.booking.findMany({
      where: { ...where, scheduledDate: { not: null }, status: { not: 'CANCELLED' } },
      select: { scheduledDate: true },
      orderBy: { scheduledDate: 'desc' },
    });

    const months = new Map();

    for (const booking of dated) {
      const key = booking.scheduledDate.toISOString().slice(0, 7);
      months.set(key, (months.get(key) ?? 0) + 1);
    }

    res.json({
      data: items,
      meta: {
        total,
        page,
        perPage,
        upcoming,
        thisMonth,
        months: [...months.entries()].map(([month, jobs]) => ({ month, jobs })),
      },
    });
  }),
);

/** Minutes between two clock times on the same day. */
const minutesBetween = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

/**
 * Extra work: a second visit, a redo, something the customer asked for on the
 * spot.
 *
 * Normal jobs are not clocked, because the price was agreed in advance. This
 * is the exception worth recording: it costs time the booking never accounted
 * for, and a run of redos for one person or one customer is worth seeing.
 */
adminEmployeesRouter.post(
  '/:id/extra-work',
  validate({ params: idParamSchema, body: extraWorkSchema }),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });

    if (!employee) throw AppError.notFound('Employee not found');

    // The id in the path wins: the office opened this person's page.
    const { employeeId, ...input } = req.body;

    const entry = await prisma.extraWork.create({
      data: {
        ...input,
        employeeId: employee.id,
        // Stored as well as the times, because the sum is what gets asked for.
        minutes: minutesBetween(input.startTime, input.endTime),
      },
      include: { booking: { select: { reference: true } } },
    });

    res.status(201).json({ data: entry });
  }),
);

/** One person's extra work, newest first, with a total per month. */
adminEmployeesRouter.get(
  '/:id/extra-work',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const entries = await prisma.extraWork.findMany({
      where: { employeeId: req.params.id },
      include: { booking: { select: { reference: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const months = new Map();

    for (const entry of entries) {
      const key = entry.date.toISOString().slice(0, 7);
      const month = months.get(key) ?? { month: key, entries: 0, minutes: 0 };

      month.entries += 1;
      month.minutes += entry.minutes;
      months.set(key, month);
    }

    res.json({ data: entries, meta: { months: [...months.values()] } });
  }),
);

adminEmployeesRouter.delete(
  '/:employeeId/extra-work/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) throw AppError.badRequest('Invalid id');

    // Deleted outright: an entry typed against the wrong person is a mistake,
    // not a record worth keeping.
    await prisma.extraWork.deleteMany({ where: { id } });

    res.status(204).end();
  }),
);
