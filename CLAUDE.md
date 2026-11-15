# CLAUDE.md — Pulsecal

Context for Claude Code. Read `HANDOFF.md` next: it has the current status and the next steps.
`FEATURES.md` (Polish, for the owner) describes what the app does; `CHANGELOG.md` is the version history.

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
**Keep usage down (owner's request):** for small changes you are confident about, `npm run build` is enough —
skip browser testing or do one minimal check. Test in the browser only for bigger or risky changes
(drag/gestures, sync, data migrations).

## Layout
```
src/
  App.tsx                 state, view switching, draft/editor state, event moves
  db.ts                   Dexie schema + local CRUD
  draft.ts                draft helpers (DRAFT_ID ghost, all-day toggle, when-label, withDraft)
  tags.ts                 tags: normalize, "Tagi: a, b" last line of the Google description, filter rule, color
  quickParse.ts           Polish one-line quick add ("dentysta jutro 14:30 1h #wizyta") → ParsedEntry
  types.ts                CalEvent, DraftEvent, ViewMode, SyncState
  colors.ts               palette + mapping to Google colorId
  time.ts                 date helpers (Monday is the first day of the week, Polish labels)
  sync/google.ts          OAuth (GIS) + sync engine
  hooks/useLiveQuery.ts   Dexie liveQuery → React
  hooks/useNow.ts         ticking clock
  hooks/useGoogleSync.ts  polling + SyncState + connect/disconnect + toast notices
  hooks/useDragGesture.ts mouse drag / touch long-press drag, auto-scroll, click suppression
  hooks/useOptimisticMove.ts  keeps a dropped event in place until liveQuery catches up
  hooks/useMediaQuery.ts  DESKTOP_QUERY (desktop → click opens the full editor)
  hooks/useAnchoredPlacement.ts  place a window next to the click point (flip/clamp to the viewport)
  components/
    CalendarMap.tsx       "map" view: days side by side, scrolled horizontally, 24 h vertically
    MonthView.tsx         GCal-style month: week rows with lanes, bars, "+N", drag + corner stretch
    QuickCard.tsx         quick add / rename card (phone default for tapping an event)
    EventSheet.tsx        full editor (desktop default; right-side panel on wide screens)
    Sidebar.tsx           left panel: action buttons, MiniCalendar, tag filter list (docked / drawer)
    MiniCalendar.tsx      mini month with ISO week numbers; drag or week number → WeekSelection
    TagInput.tsx          tag chips editor with suggestions
    SearchSheet.tsx       search (title/notes/tags) + "Utwórz …" from quickParse; opened by the dock pill or "/"
    SheetFrame.tsx        shared window shell: bottom sheet / popover at the cursor (desktop) / top palette
    SyncIndicator.tsx, Toast.tsx, sheetMotion.ts
    SettingsSheet.tsx     Client ID, calendar, polling interval
public/                   icons, favicon
```

## Conventions and decisions
- UI copy in Polish, lowercase in headings ("mapa", "miesiąc"). Comments can be Polish or English.
- Times are stored as epoch ms (local time). All-day `end` = **last millisecond of the last day**;
  Google's end is exclusive (the next day), so convert at the boundary (`sync/google.ts`).
- Tags: local field `CalEvent.tags` (casing as typed; compare via `tagKey()` = lowercase; Dexie v3 `*tags` index).
  Title starting with „!” → tag „ważne” via `autoTags()` (app saves and Google pulls). Only at the Google boundary
  (`parseGEvent`/`toGEvent`) do they become the last description line `Tagi: a, b` via `splitTags`/`joinTags`.
  Filter rule: an event is visible if any of its tags is visible (`isVisible` in `tags.ts`).
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
Local git repo on `master`, no remote yet (and no `gh` CLI installed).

## Versions and commits (owner's request)
Every finished batch of work is a version, committed as soon as it is done:
1. `npm run build` passes.
2. Bump the version: `npm version X.Y.Z --no-git-tag-version` (new features → minor, fixes only → patch).
3. Add a `## [X.Y.Z] – YYYY-MM-DD: title` section at the top of `CHANGELOG.md` (Polish, owner-facing);
   update `FEATURES.md` if behaviour changed, and `HANDOFF.md` for the next session.
4. One commit `vX.Y.Z: title` whose body is that changelog section, then an annotated tag `vX.Y.Z`.
Commit directly on `master` (solo project, the owner wants one commit per version in its history).
