# HANDOFF: Pulsecal work status (2026-11-15)

Previous sessions: first Cursor IDE (built the MVP), then Claude in a chat session, which did the
code audit and rewrote the data and sync layer, then stopped at the owner's request.
**Start by reading `CLAUDE.md`.**

## 1. Current state of `src/` (the code you see)
Unchanged MVP from Cursor. It builds, and these work: the map view (21 days horizontally), the month view,
adding/editing/deleting in the bottom sheet, IndexedDB, the PWA, and a basic sync with Google.

## 2. Bugs found in the MVP (why sync was rewritten)
1. **Polling overwrites local edits.** `pullGoogleRange` writes Google's version over an unsent local change,
   and a failed PATCH loses the change.
2. **No pagination** (`maxResults=250` without `pageToken`).
3. **Events deleted in Google stay local forever** (`showDeleted=false` and no diff).
4. **Color resets after the first sync.** `toGEvent` doesn't send `colorId`, so the event comes back as "sky".
5. **Token in `sessionStorage`**, which is lost when the iOS PWA restarts.
6. **Polling after the token expires calls `connectGoogle()` → popup without a user gesture**, which Safari blocks.
   Also, `connectGoogle` does `await loadGis()` before `requestAccessToken`, so the user gesture is lost.
7. **Sample events (seed) would be pushed to the real Google Calendar** on the first connection.
8. `deleteOnGoogle` doesn't check `res.ok`, and 404/410 should count as success.
9. No sync mutex (the interval and "Sync now" can run in parallel).
10. Duplicates are possible when a POST succeeds but the response is lost.

## 3. Ready (WIP), in `handoff/wip/src/`, NOT yet copied into `src/`
These files are rewritten and **pass `tsc` on their own**. They are not wired in because the old
`App.tsx` and components use the removed API (13 TS errors after copying). They have not been run in a browser.

| File | What changed |
|---|---|
| `types.ts` | `CalEvent.pending: 0\|1`, `recurring?`, type `SyncState = off\|idle\|syncing\|expired\|offline\|error` |
| `colors.ts` | palette with `gid` (Google colorId), `paletteById/ByValue`, corrected `GOOGLE_COLOR_MAP` |
| `time.ts` | added `addMonths`, `dayDiff`, `dayRange`, `nextQuarter`, `parseLocalInput` (safe, NaN→null), `toDateInput`, `fromIsoDate`, `formatDuration`, `longDateLabel`, constants `MINUTE/HOUR/DAY`. **Removed `weekDays()`** (replaced by `dayRange`) |
| `db.ts` | Dexie **v2** with a `pending` index + an upgrade that removes the 3 seed entries and fills in `pending`. No more seeding. API: `newEventId()`, `saveLocal()`, `removeLocal()`, `eventsInRange()`, `searchEvents()`, `pendingCount()`. **Removed:** `seedIfEmpty`, `upsertEvent`, `softDeleteEvent` |
| `sync/google.ts` | full rewrite, see below |

### New sync engine (`sync/google.ts`), public API
- `getStoredClientId / setStoredClientId`, `getCalendarId`, `switchCalendar(id)` (async: removes events
  from the old calendar and queues its own events to be copied into the new one)
- `preloadGoogle()`: call at startup and after the Client ID changes
- `connectGoogle()`: **call directly from onClick**; prompt `consent` the first time, `""` after that
- `disconnectGoogle()` (revoke + clears state), `isGoogleLinked()`, `hasValidToken()`, `tokenExpiresAt()`
- `syncNow(from, to, {forceFull?})` → `{pulled, pushed, removed, full}`. Mutex, pushes first, then pulls.
  Full window pull (±14 days beyond the view, detects deletions) when the window changes or every 10 minutes;
  in between, it pulls incrementally via `updatedMin` (cheap, so polling every 10–15 seconds is OK).
- `NeedsAuthError`: thrown when there's no token or on 401/insufficient scope → UI state `expired`
- `listCalendars()`: the writable calendars (scope `calendar.calendarlist.readonly` added, **so this requires re-consent**)
- Conflicts: last writer wins (`updatedAt` vs `updated`). Etag is used only to skip events that haven't changed.
- `extendedProperties.private`: `pulseId` (local ID, to merge across devices) and `pulseColor`.

## 4. Next steps (proposed order)
1. **Copy `handoff/wip/src/*` over `src/`** and fix the imports in `App.tsx`/components:
   - `seedIfEmpty` → remove; `upsertEvent` → `saveLocal`; `softDeleteEvent`+`deleteOnGoogle` → `removeLocal` + trigger sync
   - `pushLocalEvent`/`syncBidirectional`/`isGoogleConnected`/`setCalendarId` → `syncNow`/`hasValidToken`/`isGoogleLinked`/`switchCalendar`
   - `weekDays(anchor, n)` → `dayRange(...)`
   - new events: `id: newEventId()`, `pending: 1`
2. **`hooks/useGoogleSync.ts`**: polling (default 30 s, min 10 s), `visibilitychange`, the `online` event,
   a debounced `requestSync()` after a local change, and a `SyncState` state. Skip polling when `!hasValidToken()`
   → `expired`. Never open the popup automatically.
3. **Sync indicator in the topbar**: green = ok, pulsing = syncing, amber = expired (click → `connectGoogle()`
   synchronously), gray = off/offline, red = error. Status messages go to a bouncy **toast** instead of a `title`.
4. **Navigation**: the map view has a wider window (~63 days, hour lines drawn with a CSS `repeating-linear-gradient`
   instead of 24 divs per column), infinite scroll (shift the anchor by 21 days near an edge and correct `scrollLeft`
   in `useLayoutEffect`), ‹ › arrows (scrollBy by 7 days), and the topbar label from the first visible day.
   Month view: ‹ › for the month, the event range must cover the 42-day grid, and count multi-day events on every day.
   Remove `useNow(1000)` from App (re-renders everything every second); give the now line its own timer.
5. **Event drag & drop + resize** in the map view: mouse → drag after 4 px; touch → long press of 280 ms,
   then `touchmove` non-passive with `preventDefault` (iOS), snap to 15 min, move across days by column width,
   a resize handle at the bottom, auto-scroll near edges, optimistic override until liveQuery catches up, and a
   "squish" animation on drop. Use `-webkit-touch-callout:none; user-select:none` on blobs.
6. **Sheets**: `AnimatePresence` (they currently vanish without an exit animation), swipe-down to close
   (`dragControls` started from the grab handle so it doesn't conflict with inputs), an "all day" toggle (`type=date`),
   quick duration chips (15m/30m/45m/1h/2h), keeping the duration when the start changes, and an origin badge
   (Google / local only / waiting to send). Settings: a `listCalendars()` dropdown after connecting.
7. **The "Szukaj w czasie albo dodaj wpis" pill** does nothing yet → a quick sheet: an input that filters
   `searchEvents()` plus the button "Utwórz „…”" with simple parsing ("jutro", "pojutro", "14:30", "30m", "1h").
   This is also a natural foundation for future ADHD features (quick capture).
8. **Animation/CSS polish**: `.event-blob` currently uses `morph` (translate 18 px + rotate 8°), which is too
   wobbly for events. Give events a subtle `border-radius` in px instead of %. Clip timed events that cross
   midnight to the day. Add `@media (prefers-reduced-motion)`, dark mode via variables (`#fffaf2`/`#efe8dc`
   are hardcoded in `.sheet`/`.field`), and desktop keyboard shortcuts (t, n, ←/→, m, Esc).
9. README: describe the hourly re-login limitation and the backend option (OAuth code flow + refresh token)
   if the owner wants polling without interruptions.

## 5. Things to watch out for
- After deploying the new scope, existing users must click "Połącz" again (consent for calendarList).
- iOS standalone PWA: GIS opens the login in an in-app sheet. Test on a real iPhone (HTTPS is required
  outside localhost, e.g. `vite --host` + a tunnel, or deploy to Vercel/Netlify, and add the origin in Google Cloud).
- `updatedMin` + `singleEvents=true`: an event moved outside the window only disappears at the next full pull (≤10 min).
- The Dexie v2 migration permanently removes the 3 example entries (only those without a `googleEventId`).
