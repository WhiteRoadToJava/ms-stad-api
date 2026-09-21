import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { runDatabaseSetup } from './config/databaseSetup.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`MA Stad API listening on port ${env.PORT} (${env.NODE_ENV})`);

  // Started only once the port is open. Running it first kept the port closed
  // for as long as the seed took, and the host treated the app as dead.
  if (process.env.DB_SETUP_ON_START === 'true') {
    runDatabaseSetup().catch((error) => console.error('[setup] crashed', error));
  }
});

/** Closes the HTTP server and the database pool before the process exits. */
const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
