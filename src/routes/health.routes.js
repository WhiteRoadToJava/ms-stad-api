import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

/**
 * GET /api/health
 * Used by the deploy pipeline and by uptime monitoring. Runs a trivial query
 * so a broken database connection is reported instead of a green light.
 */
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let database = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);
