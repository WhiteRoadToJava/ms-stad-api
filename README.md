# MA Städ — API

REST API for the MA Städ website: services catalogue, price calculation,
bookings, quotes, job applications and the admin dashboard.

**Stack:** Node 20+ · Express · JavaScript (ESM) · Prisma · MySQL

---

## Getting started

```bash
npm install            # also runs `prisma generate`
cp .env.example .env   # then fill in DATABASE_URL and the JWT secrets
npm run db:push        # creates the tables from prisma/schema.prisma
npm run dev            # http://localhost:4000
```

Check that it is alive:

```bash
curl http://localhost:4000/api/health
```

Generate the two JWT secrets with:

```bash
openssl rand -base64 48
```

### Local MySQL

Any MySQL 8 instance works. With Docker:

```bash
docker run --name ma-stad-db -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=ma_stad -p 3306:3306 -d mysql:8
```

Then set `DATABASE_URL="mysql://root:secret@localhost:3306/ma_stad"`.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode via `node --watch` |
| `npm run build` | Regenerates the Prisma client (run after schema changes) |
| `npm start` | Run the server (used in production) |
| `npm run db:push` | Sync the schema without creating a migration (development) |
| `npm run db:migrate` | Create and apply a named migration |
| `npm run db:studio` | Browse the data in Prisma Studio |

---

## Conventions

- **Money is stored in öre** (1 kr = 100 öre) as integers. Never use floats for
  prices. Convert only when displaying.
- **Prices are recalculated on the server** before anything is written. A price
  arriving in a request body is treated as untrusted input.
- **Every error response has the same shape:**
  `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- **Validation happens at the edge** with Zod, in the `validate` middleware, so
  controllers receive typed data.
- **Comments explain why, not what.** Skip the comment if the code already says it.

---

## Project layout

```
prisma/schema.prisma   Data model, single source of truth for the database
src/config/            Validated env, Prisma client
src/routes/            Route definitions, one file per resource
src/controllers/       Request handling, no business logic
src/services/          Business logic: pricing, availability, mail
src/middleware/        Auth, validation, rate limits, error handling
src/utils/             Small helpers (money, async wrapper, AppError)
```

---

## Deploying to Hostinger

The API runs as a Node.js app on a subdomain, e.g. `api.mastad.se`.

1. **Database** — hPanel → Databases → MySQL. Create the database and user,
   then copy the connection details into `DATABASE_URL`.
2. **App** — hPanel → Websites → Add Website → Node.js → Import Git Repository,
   and pick this repo. Every push to `main` triggers a rebuild.
3. **Build settings** — build command `npm run build`, start command `npm start`,
   entry file `src/server.js`.
4. **Environment variables** — add every key from `.env.example` in the app's
   environment settings. Never commit the real `.env`.
5. **Migrations** — run `npx prisma migrate deploy` from the app terminal after
   a schema change.

### Notes specific to shared hosting

- The app directory is replaced on each deploy, so nothing may be written to
  disk and expected to survive. Uploaded CVs are emailed as attachments and only
  their filename is stored.
- TLS is terminated in front of Node, so `trust proxy` is enabled; without it
  rate limiting would see a single IP for all traffic.
- Background work belongs in an hPanel cron job hitting an authenticated
  endpoint, not in a long-running timer inside the process.
