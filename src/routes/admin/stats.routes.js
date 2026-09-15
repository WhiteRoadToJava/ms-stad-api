import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const adminStatsRouter = Router();

/** The numbers the dashboard opens with: what needs attention today. */
adminStatsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [newBookings, todayBookings, weekBookings, openQuotes, pendingCallbacks, monthly] =
      await Promise.all([
        prisma.booking.count({ where: { status: 'NEW' } }),
        prisma.booking.count({
          where: { scheduledDate: today, status: { not: 'CANCELLED' } },
        }),
        prisma.booking.count({
          where: {
            scheduledDate: { gte: today, lte: weekAhead },
            status: { not: 'CANCELLED' },
          },
        }),
        prisma.quote.count({ where: { status: { in: ['NEW', 'CONTACTED'] } } }),
        prisma.callbackRequest.count({ where: { handled: false } }),
        prisma.booking.aggregate({
          _sum: { totalPrice: true },
          _count: true,
          where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        }),
      ]);

    res.json({
      data: {
        newBookings,
        todayBookings,
        weekBookings,
        openQuotes,
        pendingCallbacks,
        monthBookings: monthly._count,
        monthRevenue: monthly._sum.totalPrice ?? 0,
      },
    });
  }),
);
