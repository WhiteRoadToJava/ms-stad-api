import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { setupState } from '../config/databaseSetup.js';

export const healthRouter = Router();

/**
 * Prisma connection error codes and what to check for each.
 *
 * Only the code and this fixed hint are ever returned. Prisma's own message
 * can contain the database host and user name, so it goes to the server log
 * and never into a public response.
 */
const DATABASE_HINTS = {
  P1000: 'Authentication failed: check the user name and password in DATABASE_URL',
  P1001: 'Cannot reach the database server: check the host and port in DATABASE_URL',
  P1002: 'The database server timed out',
  P1003: 'The database does not exist: check the database name in DATABASE_URL',
  P1010: 'The user has no access to this database',
  P1011: 'TLS connection to the database failed',
  P1013: 'DATABASE_URL is malformed: special characters in the password must be URL encoded',
  P1017: 'The database server closed the connection',
  P2021: 'A table is missing: the database has not been set up yet',
};

/**
 * GET /api/health
 *
 * Used by the deploy pipeline and by uptime monitoring. Checks the connection
 * and that the tables exist, says which part failed, and while a one-off setup
 * is running reports its progress, so a deploy can be diagnosed from a browser
 * without access to the server logs.
 */
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let database = 'up';
    let error;

    try {
      // Counting services rather than SELECT 1: a connection to an empty
      // database used to report healthy while every real page failed.
      await prisma.service.count();
    } catch (caught) {
      database = 'down';

      const code = caught?.errorCode ?? caught?.code ?? 'UNKNOWN';
      error = { code, hint: DATABASE_HINTS[code] ?? 'See the server log for details' };

      console.error('[health] database check failed:', code, caught?.message);
    }

    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      ...(error ? { error } : {}),
      ...(setupState.state === 'idle' ? {} : { setup: setupState }),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);
