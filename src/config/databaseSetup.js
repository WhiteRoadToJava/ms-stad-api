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
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prisma } from './prisma.js';

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

/**
 * The committed SQL for an empty database, generated on a developer machine by
 * `npm run db:export-sql`. Preferred over `prisma db push` because it runs
 * through the query engine the server already uses, while `db push` needs the
 * separate schema engine, which the hosting plan would not run.
 */
const SCHEMA_SQL = new URL('../../prisma/schema.sql', import.meta.url);

const readSchemaSql = () => {
  const buffer = readFileSync(SCHEMA_SQL);

  // A file redirected with `>` in Windows PowerShell arrives as UTF-16 with a
  // byte order mark. Accept it rather than fail on invisible bytes.
  const text =
    buffer[0] === 0xff && buffer[1] === 0xfe
      ? buffer.toString('utf16le')
      : buffer.toString('utf8');

  return text.replace(/^\uFEFF/, '');
};

/** Splits Prisma's generated script into statements, dropping comment lines. */
const splitStatements = (sql) =>
  sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

const FOREIGN_KEY = /^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)` FOREIGN KEY/i;

const constraintExists = async (table, name) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    table,
    name,
  );
  return Number(rows[0]?.n ?? 0) > 0;
};

/**
 * Applies schema.sql so that running it twice is harmless: tables are created
 * only if missing, and a foreign key that already exists is skipped. That is
 * what lets an interrupted setup simply be started again.
 */
const applySchemaSql = async () => {
  const statements = splitStatements(readSchemaSql());
  let applied = 0;

  for (const statement of statements) {
    const foreignKey = statement.match(FOREIGN_KEY);

    if (foreignKey && (await constraintExists(foreignKey[1], foreignKey[2]))) continue;

    await prisma.$executeRawUnsafe(
      statement.replace(/^CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `'),
    );
    applied += 1;
  }

  console.log(`[setup] applied ${applied} of ${statements.length} schema statements`);
};

/**
 * Keeps the end of a failed command's output for the public health response,
 * with anything that could identify the database removed first. Prisma's
 * messages name the host, the user and sometimes the full connection string.
 */
/**
 * The human part of an error: its message with the stack removed. Prisma puts
 * the useful sentence at the end of the message, after the call it failed on.
 */
const messageOf = (error) =>
  String(error?.message ?? error)
    .split('\n')
    .filter((line) => !/^\s*at\s/.test(line))
    .join('\n');

const redact = (text) =>
  text
    .replace(/mysql:\/\/\S+/gi, 'mysql://[redacted]')
    .replace(/[\w.-]+@[\w.-]+/g, '[redacted]')
    .replace(/`[^`]*`/g, '`[redacted]`')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '[redacted]')
    // 'user'@'host' in MySQL's access errors. Only that pair: other quoted
    // words, such as the name of the limit that was hit, are what we need.
    .replace(/'[^'\s]*'@'[^'\s]*'/g, "'[redacted]'@'[redacted]'")
    // Hostinger prefixes every database and user name with the account id.
    .replace(/\bu\d{6,}_\w+/g, '[redacted]')
    .replace(/\b[\w-]+(?:\.[\w-]+)+\.(?:io|com|net|se|org)\b/gi, '[redacted]')
    // The account's home directory carries its id.
    .replace(/\/home\/[^/\s]+/g, '/home/[redacted]')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^at\s/.test(line))
    .slice(-4)
    .join(' | ')
    .slice(-400);

export const runDatabaseSetup = async () => {
  Object.assign(setupState, {
    state: 'running',
    step: 'schema',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  console.log('[setup] creating tables');

  if (existsSync(SCHEMA_SQL)) {
    try {
      await applySchemaSql();
    } catch (error) {
      Object.assign(setupState, {
        state: 'failed',
        finishedAt: new Date().toISOString(),
        error: {
          step: 'schema',
          code: error?.code ?? error?.meta?.code ?? 'SQL_FAILED',
          detail: redact(String(error?.message ?? error)),
        },
      });
      console.error('[setup] creating tables failed', error);
      return;
    }
  } else {
    // Fallback when no schema.sql has been committed. Without
    // --accept-data-loss Prisma stops instead of dropping a column.
    const schema = await run(NODE, [PRISMA_CLI, 'db', 'push', '--skip-generate']);

    if (schema.code !== 0) {
      Object.assign(setupState, {
        state: 'failed',
        finishedAt: new Date().toISOString(),
        error: {
          step: 'schema',
          code: describeFailure(schema),
          detail: redact(schema.output),
        },
      });
      console.error('[setup] creating tables failed');
      return;
    }
  }

  setupState.step = 'seed';
  console.log('[setup] seeding');

  try {
    // In-process, through the server's own Prisma client. A separate Node
    // process brought its own engine and connection pool, and failed on its
    // first write under the host's per-user limits.
    const { runSeed } = await import('../../prisma/seed.js');
    await runSeed(prisma);
  } catch (error) {
    Object.assign(setupState, {
      state: 'failed',
      finishedAt: new Date().toISOString(),
      error: {
        step: 'seed',
        code: error?.code ?? error?.meta?.code ?? error?.name ?? 'SEED_FAILED',
        detail: redact(messageOf(error)),
      },
    });
    console.error('[setup] seeding failed', error);
    return;
  }

  Object.assign(setupState, {
    state: 'done',
    step: null,
    finishedAt: new Date().toISOString(),
  });

  console.log('[setup] Database ready. Remove DB_SETUP_ON_START and redeploy.');
};
