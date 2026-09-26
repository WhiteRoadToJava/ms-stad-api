import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import {
  employeeSchema,
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

    res.json({
      data: items,
      meta: { total, page, perPage, upcoming, thisMonth },
    });
  }),
);
