# Rawia Battle — onsite vote kiosk

Onsite kiosk polling app for **Rawia Cafe**. Customers buy, tap their side on a Rawia-controlled
tablet, see a 2–3 second celebration (the Rawia jug pours a cup), and the screen resets for the next
customer. Management gets a secure dashboard with every vote as an individual, auditable record.

First campaign: **UOS vs AUS** (September 2026). Any **2–6 contestants** work — add, remove, reorder
and rename them (short code + full name) in **Admin → Settings**, together with the headline and
subline, so the same app can run a six-university battle or *Nissan Patrol vs Land Cruiser* next season.
Kiosk cards, the leaderboard, analytics, exports and the reset all follow the configured list.

Styling follows the Rawia brand guide: Light Apricot `#f5f0e8` canvas with a fine grid, Brick Red
`#b63a2b` / Dark Coffee `#311f15` contestant cards, Dusty Olive `#6e7a3a` accents, Open Sans type and
the untouched vector logo (`public/rawia-*.svg`).

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
| `/admin/settings` | Management | Campaign name/dates, contestants (2–6, add/remove/reorder), headline copy, score visibility, attract screen, pause/reopen. |
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
cp .env.example .env          # then edit DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup              # runs migrations + seed (admin, RAWIA-KIOSK-01, demo votes)
npm run dev                   # http://localhost:3000
```

The seed prints the kiosk device token **once**. Open `http://localhost:3000/vote`, paste the token,
and the kiosk is authorised (stored in an httpOnly cookie on that browser). Log in at `/admin` with
`ADMIN_USERNAME` (default `admin`) / `ADMIN_PASSWORD`.

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

## Going live on a rawia.ae subdomain (e.g. `battle.rawia.ae`)

1. **Pick a host** with Node 20 + PostgreSQL. Simplest: Vercel (app) + Neon (Postgres), or Railway /
   Render which bundle both. A single small instance is plenty for a few kiosks.
2. **Create the database** and copy its `DATABASE_URL` (use the pooled/SSL URL if offered).
3. **Set environment variables** on the host: `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -hex 32`),
   `ADMIN_USERNAME` (default `admin`), `ADMIN_EMAIL` (contact only), `ADMIN_PASSWORD` (≥ 8 chars, a real password manager one), `SEED_DEMO_DATA=false`,
   `CAMPAIGN_TIMEZONE=Asia/Dubai`.
4. **Deploy** from the GitHub repo. Build `npm run build`, start `npm start`. Then run once from the
   host's shell / one-off job: `npm run db:setup` — it creates the tables, the admin user and the first
   kiosk device and prints its token **once**. Save it.
5. **DNS**: in the rawia.ae DNS panel add a `CNAME` record `battle` → the hostname your host gives you
   (e.g. `cname.vercel-dns.com`). Add `battle.rawia.ae` as a custom domain in the host; it issues the
   HTTPS certificate automatically (usually < 10 min after DNS propagates).
6. **Configure the campaign**: log in at `https://battle.rawia.ae/admin`, Settings → contestants,
   headline, dates, score visibility. Devices → add one device per tablet.
7. **Tablets**: open `https://battle.rawia.ae/vote`, paste the device token, then lock the browser to
   that page (iPad Guided Access, Android Fully Kiosk / pinned app). Disable sleep.
8. **Dry run**: tap both sides, confirm the animation only appears after the vote is stored, check
   `/battle` on a TV/phone, invalidate + restore a vote, export CSVs, then **Reset scores** (type `RESET`)
   so opening day starts at 0–0.
9. **Ops**: turn on daily DB backups at the host, keep `/admin/audit` handy, and re-run
   `npm run db:migrate` after deploying any release that adds a migration.

## Deploying on Replit

1. Import the repo. Add a **PostgreSQL** database (Replit → Tools → Database) — it provides `DATABASE_URL`.
2. In **Secrets** set `SESSION_SECRET` (`openssl rand -hex 32`), `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 8 chars).
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
   **Reset scores** (type `RESET`) does the same for a live campaign at any time — every vote for the
   campaign is deleted and the removed totals are written to the audit log, so export a CSV first.
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
`campaigns` (settings) · `contestants` (2–6 per campaign: code, name, position) · `devices` · `votes` (one row per purchase: contestant code in `university`, timestamp, device,
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

## Project history — every step we took, and why

A chronological record of how this app went from brief to production, so anyone can retrace it.

### 1. Brief → first working app (PR: initial commit on `main`)
- **Goal**: one purchase at Rawia = one onsite vote (PURCHASE → VOTE → RESULT → RESET), no customer accounts, no PII.
- Chose the stack: Next.js 16 App Router + TypeScript, Tailwind 4, PostgreSQL via Drizzle ORM, `jose` sessions, Vitest.
- Built the data model (`campaigns`, `devices`, `votes`, `admin_users`, `audit_logs`) and SQL migrations in `drizzle/`.
- Built `POST /api/vote` with the safety rules that still hold today: device token required, campaign must be live,
  `clientVoteId` idempotency, per-device row lock + 1.5 s duplicate-tap window, invalid votes kept but excluded from totals.
- Built the `/vote` kiosk (attract screen, vote, confirmation, ended, unauthorised, offline states), the read-only `/battle`
  leaderboard, and the admin dashboard (overview, votes with invalidate/restore, daily/hourly analytics, devices, settings,
  audit log, CSV exports). Added the September countdown and automatic close at Dubai midnight after the end date.
- Wrote tests (pure logic + DB integration), lint, typecheck, build, and this README.

### 2. Rawia branding, animation, reset, editable contestants ([PR #1](https://github.com/mohamedsikanderadam/rawiacompetition/pull/1))
- Applied the Rawia brand guide: Light Apricot canvas, Brick Red / Dark Coffee cards, Dusty Olive accents, Open Sans,
  untouched vector logo (`public/rawia-*.svg`).
- Added the confirmation animation: the Rawia jug pours a cup, confetti, animated counters.
- Added the audited **Reset scores** button on the admin overview (type `RESET`; deletes campaign votes, logs removed totals).
- Made contestant names/codes, headline and subline editable in Settings so the same app can run other campaigns
  (e.g. Nissan Patrol vs Land Cruiser).
- Wrote the go-live plan for a `rawia.ae` subdomain (section above).

### 3. Username login ([PR #2](https://github.com/mohamedsikanderadam/rawiacompetition/pull/2))
- Admin login switched from email to **username** (`admin`); the email is kept only as a contact field.
- Admin password minimum lowered from 12 to 8 characters at the owner's request.

### 4. Production database and hosting
- Created a Neon PostgreSQL project; ran `npm run db:migrate` against it, then created the `admin` user and the first
  kiosk device `RAWIA-KIOSK-01` (token delivered privately — it is shown only once).
- Imported the GitHub repo into Vercel with env vars `DATABASE_URL`, `SESSION_SECRET`, `SEED_DEMO_DATA=false`,
  `CAMPAIGN_TIMEZONE=Asia/Dubai`. Every merge to `main` now auto-deploys to `rawiacompetition.vercel.app`.
- Still to do for the custom domain: add `battle.rawia.ae` in Vercel → Domains and a `CNAME battle → cname.vercel-dns.com`
  record at the rawia.ae DNS provider.

### 5. Any number of contestants, 2–6 ([PR #3](https://github.com/mohamedsikanderadam/rawiacompetition/pull/3))
- Replaced the fixed A/B columns with a `contestants` table (code, name, position, unique per campaign).
  Migration `0003` backfills the existing UOS/AUS rows **before** dropping the old columns; applied to Neon with zero data loss.
- Settings → Contestants: add / remove / move up / move down, minimum 2, maximum 6, unique codes, all changes audited.
- Kiosk cards, battle meter (segmented share of vote), `/battle`, admin overview, votes filter, analytics charts, CSV
  exports and reset all follow the configured list; a six-colour brand palette assigns a colour per position.
- Winner/tie logic handles multi-way ties; percentages always sum to 100 for any count.
- Note: changing a contestant's *code* hides votes recorded under the old code (they stay in the database); renaming the
  full name is always safe.

### 6. Post-release fixes found by a recorded end-to-end browser test
- [PR #4](https://github.com/mohamedsikanderadam/rawiacompetition/pull/4): admin pages crashed because server pages called
  a helper from a `"use client"` module; colour helpers moved to `src/lib/contestants.ts`.
- [PR #5](https://github.com/mohamedsikanderadam/rawiacompetition/pull/5): admin pages taller than the screen rendered
  their lower half on the cream body background; the layout wrapper now grows with its content. Also added the E2E test
  procedure in `.agents/skills/testing-rawia-battle/SKILL.md`.
- The test covered: adding/reordering to 4 contestants, validation (duplicate code, min 2, max 6), voting for each on the
  kiosk with animation and tally, `/battle` with 4 cards, admin pages and reset to zero, and reverting to 2 contestants.

### Routine for future releases
1. Branch from `main`, make the change, run `npm run lint && npm run typecheck && npm test && npm run build`.
2. If `src/db/schema.ts` changed, run `npm run db:generate` and check the SQL in `drizzle/`.
3. Open a PR; Vercel builds a preview. Merge → production deploy.
4. If the release added a migration, run `DATABASE_URL=<neon url> npm run db:migrate` once (before or right after merging).

## Project layout

```
src/app/vote            kiosk page          src/components/kiosk      kiosk UI
src/app/battle          public leaderboard  src/components/battle     scoreboard, meter, confetti
src/app/admin           admin pages/actions src/components/admin      admin UI kit
src/app/api             route handlers      src/lib                   domain logic (battle, votes, analytics, auth, time)
src/db                  drizzle schema/client  drizzle/               SQL migrations
scripts/seed.ts         seed                tests/                    vitest
```
