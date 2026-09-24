import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import {
  employeeSchema,
  idParamSchema,
  updateEmployeeSchema,
} from '../../validation/admin.schemas.js';

export const adminEmployeesRouter = Router();

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
