# Rawia University Battle — UOS vs AUS

Onsite kiosk polling app for **Rawia Cafe**. Students buy, tap their university on a Rawia-controlled
tablet, see a 2–3 second celebration, and the screen resets for the next student. Management gets a
secure dashboard with every vote as an individual, auditable record.

**FAST. FUN. CONTROLLED. AUDITABLE.**

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/vote` | Kiosk (Rawia device) | Fullscreen voting screen. Requires a device token (entered once by staff). |
| `/battle` | Public | Read-only live leaderboard for TV, Instagram, QR codes. Cannot vote. |
| `/admin` | Management | Overview, today's performance, go-live controls, CSV exports. |
| `/admin/votes` | Management | Every vote; filter by university / date / time / device; invalidate or restore. |
| `/admin/analytics` | Management | By day, by hour, cumulative, by device, daily trend table. |
| `/admin/devices` | Management | Register kiosks, generate/rotate tokens, deactivate. |
| `/admin/settings` | Management | Campaign name/dates, universities, score visibility, attract screen, pause/reopen. |
| `/admin/audit` | Management | Immutable log of admin actions. |

API: `POST /api/vote` (kiosk only), `GET /api/kiosk/state` (kiosk only), `POST /api/kiosk/register`,
`GET /api/score` (public), `GET /api/admin/export/{votes,summary}.csv` (admin only).

## Stack

Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM (migrations in
`drizzle/`) · `jose` sessions · `bcryptjs` · Vitest.

## Local setup

Requirements: Node 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup              # runs migrations + seed (admin, RAWIA-KIOSK-01, demo votes)
npm run dev                   # http://localhost:3000
```

The seed prints the kiosk device token **once**. Open `http://localhost:3000/vote`, paste the token,
and the kiosk is authorised (stored in an httpOnly cookie on that browser). Log in at `/admin` with
`ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Need a throwaway Postgres? `docker run -d --name rawia-pg -e POSTGRES_PASSWORD=rawia -e POSTGRES_DB=rawia -p 5433:5432 postgres:16-alpine`
matches the default `DATABASE_URL` in `.env.example`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js dev / production build / serve |
| `npm run db:generate` | Generate a new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Idempotent seed (admin, first kiosk, demo data) |
| `npm test` | Vitest — pure logic + database integration tests (needs `DATABASE_URL`) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |

## Deploying on Replit

1. Import the repo. Add a **PostgreSQL** database (Replit → Tools → Database) — it provides `DATABASE_URL`.
2. In **Secrets** set `SESSION_SECRET` (`openssl rand -hex 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 12 chars).
   Optional: `KIOSK_SEED_TOKEN`, `SEED_DEMO_DATA=false`, `CAMPAIGN_TIMEZONE` (default `Asia/Dubai`).
3. Run once in the shell: `npm install && npm run db:setup` — copy the printed kiosk token.
4. Build command `npm run build`, run command `npm start` (Autoscale or Reserved VM). Re-run
   `npm run db:migrate` whenever a new migration lands.
5. On the tablet open `https://<your-app>/vote`, enter the token, then add the page to the home screen /
   use a kiosk browser (Fully Kiosk, Guided Access, etc.) so students can't leave the page.

Any host with Node 20 + Postgres works the same way (Railway, Render, Fly, a VPS).

## Going live checklist

1. Admin → **Devices**: make sure the real tablet is authorised and shows votes on the kiosk test.
2. Admin → **Settings**: confirm dates (1–30 Sep 2026), decide *Show live scores on voting screen*.
3. Admin → **Overview** → **Start live campaign** (type `GO LIVE`). This deletes demo votes, sets the
   score to 0–0, and writes an audit entry. Until then the sidebar shows a **Demo data** badge.
4. Keep `/vote` open on the tablet; it needs no attention. It re-syncs settings every 15 s, retries
   on network blips, shows a red **OFFLINE** bar when the connection drops and never shows success
   unless the server confirmed the vote was stored.

## How it works

### Voting flow
Tap → both buttons lock immediately → `POST /api/vote` with a random `clientVoteId` → server stores
exactly one row → confirmation (`+1 UOS 🔥`, confetti, animated counters, battle meter) for
`confirmationDurationMs` (default 2.5 s) → automatic reset. If the request fails the kiosk shows
**VOTE NOT RECORDED** instead of a false success.

### Double-vote protection (server side)
* `votes.client_vote_id` is unique; a retried request returns the original vote (idempotent).
* Votes are serialised per device (`SELECT … FOR UPDATE`) and a second vote from the same device within
  1.5 s is rejected as a double tap (`409 too_fast`). Frontend locking is a convenience, not the guard.

### Device authorisation
Each kiosk gets a random token created in Admin → Devices. Only its SHA-256 hash is stored. The kiosk
sends it via an httpOnly cookie (or `x-kiosk-token` header). `POST /api/vote` verifies: device known +
active, campaign active, within dates (or manually reopened), university valid, not a duplicate.
Discovering `/vote` or the API without a token yields `401`.

### Data model
`campaigns` (settings) · `devices` · `votes` (one row per purchase: university, timestamp, device,
session, status `valid|invalid`, invalidation metadata) · `admin_users` · `audit_logs`.
Leaderboards are always computed from `votes WHERE status = 'valid'`; nothing is hard-deleted except
by the explicit **Start live campaign** / **Reset demo data** actions, which are themselves audited.

### Time zone
"Today", daily analytics, and the campaign end (midnight after the end date) use `CAMPAIGN_TIMEZONE`
(default `Asia/Dubai`).

### Security notes
bcrypt password hashing · signed httpOnly session cookies (8 h) · `proxy.ts` gate on `/admin/**` and
`/api/admin/**` plus server-side re-checks · zod validation on every input · parameterised queries
via Drizzle · in-memory rate limits on login, vote and kiosk registration · no student PII collected.

## Project layout

```
src/app/vote            kiosk page          src/components/kiosk      kiosk UI
src/app/battle          public leaderboard  src/components/battle     scoreboard, meter, confetti
src/app/admin           admin pages/actions src/components/admin      admin UI kit
src/app/api             route handlers      src/lib                   domain logic (battle, votes, analytics, auth, time)
src/db                  drizzle schema/client  drizzle/               SQL migrations
scripts/seed.ts         seed                tests/                    vitest
```
