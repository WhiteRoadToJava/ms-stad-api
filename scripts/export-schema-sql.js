/**
 * Writes prisma/schema.sql: the SQL that creates every table from an empty
 * database, generated from prisma/schema.prisma.
 *
 *   npm run db:export-sql
 *
 * Run it on your own machine after every change to schema.prisma, and commit
 * the result. It connects to no database; it only reads the schema file.
 *
 * Why this exists: `prisma db push` needs Prisma's schema engine, a separate
 * native program that the hosting plan will not run. The server can, however,
 * run plain SQL through the query engine it already uses for every request, so
 * the production tables are created from this file instead.
 *
 * The output is written by Node rather than redirected with `>` in PowerShell,
 * because Windows PowerShell writes redirected text as UTF-16, which MySQL
 * would not parse.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { cwd: root, encoding: 'utf8' },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'prisma migrate diff failed\n');
  process.exit(result.status ?? 1);
}

const output = path.join(root, 'prisma', 'schema.sql');
writeFileSync(output, result.stdout, 'utf8');

const tables = (result.stdout.match(/CREATE TABLE/g) ?? []).length;
process.stdout.write(`Wrote ${tables} tables to ${output}\n`);
