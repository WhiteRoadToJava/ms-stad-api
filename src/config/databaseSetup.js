/**
 * One-off database setup, run by the server itself on start.
 *
 * The hosting plan gives no shell, and reaching the production database from
 * a laptop means opening it to the internet and risking a command aimed at the
 * wrong database. So the server does it: set DB_SETUP_ON_START=true in hPanel,
 * redeploy, open the site once, then remove the variable and redeploy again.
 *
 * Both steps are safe to repeat. `db push` refuses changes that would drop
 * data, and the seed only creates what is missing and never overwrites the
 * prices staff have edited.
 */
import { execSync } from 'node:child_process';

export const runDatabaseSetup = () => {
  console.log('[setup] DB_SETUP_ON_START is set, preparing the database');

  // Without --accept-data-loss Prisma stops instead of dropping a column, which
  // is the behaviour we want on a database holding real bookings.
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  execSync('node prisma/seed.js', { stdio: 'inherit' });

  console.log('[setup] Database ready. Remove DB_SETUP_ON_START and redeploy.');
};
