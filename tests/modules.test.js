/**
 * Loads every route and service module.
 *
 * A missing import is invisible to `node --check`, which only parses: the file
 * is valid JavaScript right up until the line runs. One reached production as
 * `ReferenceError: requireRole is not defined`, thrown while the server was
 * starting, which meant the whole API was down rather than one endpoint.
 *
 * Importing a module runs everything at its top level, which is where route
 * definitions live, so anything undefined there fails here instead.
 *
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// The real client needs generated engines and a reachable database; neither is
// the point here, and both would turn a fast check into an integration test.
process.env.DATABASE_URL ??= 'mysql://test:test@localhost:3306/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-16';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-16';

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.js') ? [full] : [];
  });

const modules = [
  ...walk(path.join(root, 'src', 'routes')),
  ...walk(path.join(root, 'src', 'services')),
  ...walk(path.join(root, 'src', 'middleware')),
];

describe('every module loads', () => {
  for (const file of modules) {
    const name = path.relative(root, file).split(path.sep).join('/');

    it(name, async () => {
      // A generated Prisma client may be missing on a fresh checkout, which is
      // an environment problem rather than a mistake in this code.
      try {
        await import(pathToFileURL(file).href);
      } catch (error) {
        // Narrowly: only the two shapes a missing generated client takes. A
        // broader match would swallow the very mistakes this test exists for.
        const clientMissing =
          /Cannot find (module|package) '@prisma\/client'/.test(error.message) ||
          /Named export 'PrismaClient' not found/.test(error.message) ||
          /@prisma\/client did not initialize/.test(error.message);

        if (clientMissing) return;

        assert.fail(`${name} failed to load: ${error.message.split('\n')[0]}`);
      }
    });
  }
});
