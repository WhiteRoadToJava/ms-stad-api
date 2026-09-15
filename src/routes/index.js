import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { servicesRouter } from './services.routes.js';
import { pricingRouter } from './pricing.routes.js';
import { availabilityRouter } from './availability.routes.js';
import { bookingsRouter } from './bookings.routes.js';
import { quotesRouter } from './quotes.routes.js';
import { callbacksRouter } from './callbacks.routes.js';
import { adminRouter } from './admin/index.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/pricing', pricingRouter);
apiRouter.use('/availability', availabilityRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/quotes', quotesRouter);
apiRouter.use('/callbacks', callbacksRouter);
apiRouter.use('/admin', adminRouter);

// Routers added in later phases:
// apiRouter.use('/applications', applicationsRouter);
