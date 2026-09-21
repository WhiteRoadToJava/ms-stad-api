import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { runDatabaseSetup } from './config/databaseSetup.js';

// Runs before the server accepts requests, so nobody reaches an empty database.
// A failure here stops the process: a half prepared database is worse than a
// site that is visibly down.
if (process.env.DB_SETUP_ON_START === 'true') {
  runDatabaseSetup();
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`MA Stad API listening on port ${env.PORT} (${env.NODE_ENV})`);
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
