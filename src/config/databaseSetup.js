/**
 * One-off database setup, run by the server itself.
 *
 * The hosting plan gives no shell, and reaching the production database from a
 * laptop means opening it to the internet and risking a command aimed at the
 * wrong database. So the server does it: set DB_SETUP_ON_START=true in hPanel,
 * redeploy, watch /api/health until setup reports done, then remove the
 * variable and redeploy again.
 *
 * It runs in the background, after the server is already listening. The host
 * kills an app that does not open its port quickly, and creating the tables
 * and seeding can take longer than that allows.
 *
 * Both steps are safe to repeat and to interrupt. `db push` refuses changes
 * that would drop data, and the seed only creates what is missing, so if the
 * process is stopped half way the next start simply finishes the job.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * Commands are run through the exact Node binary that is running this server,
 * with the Prisma CLI addressed by its file path.
 *
 * The first version called `npx` and `node` by name, which depends on PATH.
 * The host starts the app with a PATH that contains neither, so the spawn
 * failed within milliseconds before Prisma ever ran.
 */
const NODE = process.execPath;
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

/** Read by the health check so progress is visible from a browser. */
export const setupState = {
  state: 'idle',
  step: null,
  startedAt: null,
  finishedAt: null,
  error: null,
};

/**
 * Runs a command and resolves with its exit code. Output goes to the server
 * log; only a Prisma error code is kept for the public health response, since
 * the raw output can contain the database host and user.
 */
const run = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    const collect = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    // A failure to start the command at all, as opposed to the command
    // failing. The error code (ENOENT, EACCES) is safe to show publicly.
    child.on('error', (error) =>
      resolve({ code: 1, output: String(error), spawnError: error.code ?? 'SPAWN_FAILED' }),
    );
    child.on('close', (code) => resolve({ code, output }));
  });

const prismaCode = (output) => output.match(/\bP\d{4}\b/)?.[0] ?? null;

/** The most specific safe description of why a step failed. */
const describeFailure = (result) =>
  result.spawnError ?? prismaCode(result.output) ?? `exit ${result.code}`;

export const runDatabaseSetup = async () => {
  Object.assign(setupState, {
    state: 'running',
    step: 'schema',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  console.log('[setup] creating tables');

  // Without --accept-data-loss Prisma stops instead of dropping a column, which
  // is what we want on a database that may already hold real bookings.
  const schema = await run(NODE, [PRISMA_CLI, 'db', 'push', '--skip-generate']);

  if (schema.code !== 0) {
    Object.assign(setupState, {
      state: 'failed',
      finishedAt: new Date().toISOString(),
      error: { step: 'schema', code: describeFailure(schema) },
    });
    console.error('[setup] creating tables failed');
    return;
  }

  setupState.step = 'seed';
  console.log('[setup] seeding');

  const seed = await run(NODE, ['prisma/seed.js']);

  if (seed.code !== 0) {
    Object.assign(setupState, {
      state: 'failed',
      finishedAt: new Date().toISOString(),
      error: { step: 'seed', code: describeFailure(seed) },
    });
    console.error('[setup] seeding failed');
    return;
  }

  Object.assign(setupState, {
    state: 'done',
    step: null,
    finishedAt: new Date().toISOString(),
  });

  console.log('[setup] Database ready. Remove DB_SETUP_ON_START and redeploy.');
};
