import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { adminAuthRouter } from './auth.routes.js';
import { adminBookingsRouter } from './bookings.routes.js';
import { adminQuotesRouter } from './quotes.routes.js';
import { adminCallbacksRouter } from './callbacks.routes.js';
import { adminServicesRouter } from './services.routes.js';
import { adminEmployeesRouter } from './employees.routes.js';
import { adminAvailabilityRouter } from './availability.routes.js';
import { adminStatsRouter } from './stats.routes.js';

export const adminRouter = Router();

// Auth handles its own protection: login and refresh have to stay reachable.
adminRouter.use('/auth', adminAuthRouter);

// Everything below this line requires a valid access token.
adminRouter.use(requireAuth);

adminRouter.use('/bookings', adminBookingsRouter);
adminRouter.use('/quotes', adminQuotesRouter);
adminRouter.use('/callbacks', adminCallbacksRouter);
adminRouter.use('/services', adminServicesRouter);
adminRouter.use('/employees', adminEmployeesRouter);
adminRouter.use('/availability', adminAvailabilityRouter);
adminRouter.use('/stats', adminStatsRouter);
