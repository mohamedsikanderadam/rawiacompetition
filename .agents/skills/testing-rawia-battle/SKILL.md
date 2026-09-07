---
name: testing-rawia-battle
description: How to run and E2E-test the RawiaBattle Next.js app locally (admin login, kiosk token, leaderboard, score API).
---

# Testing RawiaBattle locally

- Start: `npm run dev` (port 3000). Postgres URL is in `.env` (`DATABASE_URL`); run `npm run db:setup` if tables/admin are missing.
- Admin login at `/admin/login` is **username**-based: username `admin` (from `ADMIN_USERNAME`, default `admin`), password = `ADMIN_PASSWORD` in `.env`.
- Kiosk `/vote` needs a device token. The seed registers `RAWIA-KIOSK-01` with `KIOSK_SEED_TOKEN` from `.env`; Chrome may already have it stored (localStorage) so /vote can load without prompting. New tokens: Admin → Devices (shown once).
- Baseline totals without auth: `curl localhost:3000/api/score` (contestants + scoreboard).
- Kiosk confirmation screen shows the tally only after ~0.5s animation delay — wait ~1.2s before screenshotting; it auto-resets after `confirmationDurationMs` (default 2500ms).
- Contestants are managed at Admin → Settings → Contestants (2–6, move up/down, Remove disabled at 2, Add disabled at 6; duplicate codes rejected server-side).
- Reset scores: Admin Overview → type `RESET`. Demo data reload also lives there.
- Known gotcha: admin pages taller than the viewport may render their bottom part on a cream background with unreadable text (flex `min-h-screen` on `bg-admin` container shrinks to 100vh). Buttons remain clickable; use DOM to locate them.
- Chrome URL bar may autocomplete `localhost:3000/admin` to a deeper admin path — use the sidebar nav for Overview.
- Server components must not import from `"use client"` modules (e.g. scoreboard.tsx); a crash "Attempted to call X() from the server" on /admin indicates this.

## Devin Secrets Needed
none (all local dev values live in `.env`).
