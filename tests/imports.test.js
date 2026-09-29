/**
 * Checks that every name a module uses is one it imported or defined.
 *
 * The module-loading test catches a missing import only when the name is used
 * at the top level. A name used inside a handler survives the import and fails
 * later, when a customer or the office presses the button: that is how
 * `releaseDay is not defined` reached a working server and broke deleting a
 * booking, after the identical mistake with `requireRole` had already been
 * fixed.
 *
 * This is a deliberately small check, not a linter. It looks for the names
 * this codebase shares between modules and asserts that a file using one has
 * imported it.
 *
 * Run with: npm test
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Helpers that live in one module and are used from many. */
const SHARED_NAMES = [
  'prisma',
  'asyncHandler',
  'AppError',
  'validate',
  'requireAuth',
  'requireRole',
  'releaseDay',
  'reserveDay',
  'openDays',
  'listAllDays',
  'listAvailability',
  'ensureUpcomingDays',
  'updateDayRange',
  'createBooking',
  'createQuote',
  'calculatePrice',
  'sendBookingEmails',
  'sendQuoteEmails',
  'sendCallbackEmail',
  'sendApplicationEmail',
  'uploadCv',
  'formLimiter',
  'loginLimiter',
];

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.js') ? [full] : [];
  });

/** Everything the file brought in, plus everything it declares itself. */
const namesAvailableIn = (source) => {
  const available = new Set();

  for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from/g)) {
    for (const name of match[1].split(',')) {
      available.add(name.trim().split(/\s+as\s+/).pop().trim());
    }
  }

  for (const match of source.matchAll(/import\s+(\w+)\s+from/g)) available.add(match[1]);
  for (const match of source.matchAll(/(?:const|let|function|class)\s+(\w+)/g)) {
    available.add(match[1]);
  }

  return available;
};

describe('every shared helper is imported where it is used', () => {
  const files = walk(path.join(root, 'src'));

  for (const file of files) {
    const name = path.relative(root, file).split(path.sep).join('/');
    const source = readFileSync(file, 'utf8');

    // Import lines are removed before looking for usage, so an import does not
    // count as using the name it brings in.
    const body = source.replace(/^import[\s\S]*?from\s+'[^']+';$/gm, '');
    const available = namesAvailableIn(source);

    const missing = SHARED_NAMES.filter(
      (shared) => new RegExp(`\\b${shared}\\b`).test(body) && !available.has(shared),
    );

    it(name, () => {
      assert.deepEqual(missing, [], `${name} uses ${missing.join(', ')} without importing`);
    });
  }
});
