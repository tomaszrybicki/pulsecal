# CLAUDE.md — Pulsecal

Context for Claude Code. Read `HANDOFF.md` next: it has the current status and the next steps.

## What this is
Pulsecal is a **Google Calendar clone as a PWA** (installed on iOS through Safari → "Add to Home Screen").
The owner (Tomasz) writes in Polish, and the UI copy is in Polish.

Product goals, in order:
1. A Google Calendar clone with a **more responsive design and nicer, "bouncy blob" animations**
   (organic shapes that gently morph, spring physics, an overshoot on drop/open).
2. **Its own local database** (IndexedDB) as the source of truth, with **Google Calendar as the backup copy**,
   so data is always available there too.
3. **Polling Google Calendar** every few seconds or minutes to pull in new entries.
4. *Later:* features for people with ADHD (don't build them yet, but don't block them either:
   quick capture, low friction, a clear "now").

## Stack
- Vite 7 + React 19 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters` on)
- Dexie 4 (IndexedDB), framer-motion 12, vite-plugin-pwa (autoUpdate, Workbox)
- Google: Google Identity Services **token flow** (client-side only, no backend) + Calendar REST v3
- Fonts: Fraunces (display) + Outfit (UI). Palette: warm paper `#efe8dc`, ink `#1c1917`

## Commands
```bash
npm install
npm run dev      # vite --host (iPhone on the same LAN: http://<pc-ip>:5173)
npm run build    # tsc --noEmit && vite build
npm run preview
```
There are no tests and no linter. "Done" means `npm run build` passes with no errors.

## Layout
```
src/
  App.tsx                 state, view switching, polling (to be rewritten, see HANDOFF)
  db.ts                   Dexie schema + local CRUD
  types.ts                CalEvent, DraftEvent, ViewMode, SyncState
  colors.ts               palette + mapping to Google colorId
  time.ts                 date helpers (Monday is the first day of the week, Polish labels)
  sync/google.ts          OAuth (GIS) + sync engine
  hooks/useLiveQuery.ts   Dexie liveQuery → React
  hooks/useNow.ts         ticking clock
  components/
    CalendarMap.tsx       "map" view: days side by side, scrolled horizontally, 24 h vertically
    MonthView.tsx         month grid
    EventSheet.tsx        bottom sheet for editing an entry
    SettingsSheet.tsx     Client ID, calendar, polling interval
public/                   icons, favicon
```

## Conventions and decisions
- UI copy in Polish, lowercase in headings ("mapa", "miesiąc"). Comments can be Polish or English.
- Times are stored as epoch ms (local time). All-day `end` = **last millisecond of the last day**;
  Google's end is exclusive (the next day), so convert at the boundary (`sync/google.ts`).
- Never use `new Date("YYYY-MM-DD")`, because it gives UTC. Use `fromIsoDate()` from `time.ts`.
- Every local change goes through `saveLocal()`/`removeLocal()` in `db.ts`, which sets `pending = 1`.
  The UI **does not call the Google API directly**; it only triggers `syncNow()`.
- Local event IDs are 32 hex characters (`newEventId()`), which are also valid Google event IDs, so
  POST is idempotent (409 → PATCH). Events that came from Google have the ID `g:<googleId>`.
- Animations: CSS keyframes for idle "morph" (subtle; only `border-radius` on events),
  framer-motion springs for sheets and transitions. Always respect `prefers-reduced-motion`.
- iOS/Safari: the OAuth popup **must** be opened synchronously in the click handler (preload GIS first:
  `preloadGoogle()`), otherwise Safari blocks it. A background PWA doesn't poll (iOS has no reliable background).
- Don't add a backend without asking the owner. It's possible ("we can use our own database"),
  but it changes the deployment. It is the only way to avoid logging in again every hour (refresh tokens).

## Owner's environment
Windows, the project lives in `C:\Users\Tomasz\Projects\pulsecal`. `node_modules` is installed for win32.
Git is initialized but has **no commits**. Before larger changes, suggest an initial commit.
