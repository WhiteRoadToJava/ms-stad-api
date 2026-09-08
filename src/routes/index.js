import { Router } from 'express';
import { healthRouter } from './health.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// Routers added in later phases:
// apiRouter.use('/services', servicesRouter);
// apiRouter.use('/pricing', pricingRouter);
// apiRouter.use('/availability', availabilityRouter);
// apiRouter.use('/bookings', bookingsRouter);
// apiRouter.use('/quotes', quotesRouter);
// apiRouter.use('/admin', adminRouter);
