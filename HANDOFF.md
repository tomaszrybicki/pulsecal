# HANDOFF: Pulsecal work status (2026-11-15)

Versions and commits: see `CHANGELOG.md` and the "Versions and commits" section of `CLAUDE.md`.

Previous sessions: first Cursor IDE (built the MVP), then Claude in a chat session, which did the
code audit and rewrote the data and sync layer, then stopped at the owner's request.
**Start by reading `CLAUDE.md`.**

## 0. Update 2026-11-15 (Claude Code session)
- Initial commit made (`9a8ae06`, the Cursor MVP + handoff notes).
- **Steps 1–3 are done** and `npm run build` passes. The `handoff/wip/src` files now live in `src/`
  (the stale `handoff/wip` copy was deleted in v0.5.0).
- `src/hooks/useGoogleSync.ts`: polling (min 10 s), visibilitychange, online/offline, debounced
  `requestSync()` after local edits, token-expiry timer → `expired`, `connect()` (sync in onClick),
  `notice` for toasts. `components/SyncIndicator.tsx` + `components/Toast.tsx` added.
- `syncNow` change: one failing event no longer blocks the queue/pull; `SyncResult` has `failed`/`pushError`.
- Settings: calendar is switched only on commit (blur/Enter, with confirm), with a `listCalendars()` dropdown
  when connected. Poll interval commits on blur.
- App: `useNow(30_000)` instead of 1 s; event range covers the whole 42-day grid in month view;
  EventSheet uses `parseLocalInput` and keeps the duration when the start changes.
- Fixed: map view opened with today scrolled under the sticky hour gutter (`scroll-padding-left`
  + DOM-based scroll target).
- Smoke-tested in a browser (Dexie v2 migration, local save with `pending=1`, settings sheet).
  **Not tested against real Google yet** (needs a Client ID): connect, push, pull, expiry, calendar switch.
- Next: step 4 (navigation).

## 0b. Update 2026-11-15, part 2: GCal parity (owner priority)
The owner's priority: easy **adding, moving (every view), renaming, event names in month view**,
and later **quick action buttons**. Done:
- **Month view rewritten** (`MonthView.tsx`): GCal-style week rows with lanes. Multi-day/all-day events
  are spanning bars, timed ones are "dot + time + name" (phone: tinted pills, name only). Overflow → "+N więcej".
  Lane capacity is measured (ResizeObserver). Weeks entirely in the next month are skipped.
  Tap empty day area → quick add (all-day by default, like GCal's "Add time"); tap the day number or "+N" → map view.
- **Drag & drop** (`hooks/useDragGesture.ts`): mouse after 4 px, touch after a 280 ms hold (non-passive
  `touchmove` on window + `preventDefault`), Esc cancels, auto-scroll near edges, swallows the click after a drop.
  The touched element must stay mounted, so views draw a separate **ghost** (`.drag-ghost` / `.m-float`)
  and fade the source. `hooks/useOptimisticMove.ts` holds the new position until liveQuery catches up + "squish".
  Map: move timed (15-min snap, across days), resize via the bottom handle, move all-day across days.
  Month: move to another day (keeps the time of day).
- **QuickCard** (`components/QuickCard.tsx`): GCal-like popover as a compact bottom card: title input,
  when-label, "+ godzina"/"cały dzień" toggle, colors, Usuń/Więcej/Zapisz. Used for new entries (slot tap,
  all-day row tap, month day tap, dock pill) and for tapping an existing entry (rename in place; tapping
  outside saves edits of existing entries, discards new ones). **Quick action buttons go into `.quick-actions`.**
- The draft is drawn live in the views (`withDraft()` in `src/draft.ts`, id `__draft__`, dashed outline).
- EventSheet: "Cały dzień" toggle with date inputs. All sheets have exit animations (`sheetMotion.ts`).
- ‹ › next to the month label: month view ±1 month, map ±7 days.
- Event blobs: radius-only `blob-soft` morph (no translate/rotate), `prefers-reduced-motion` respected.
- Tested in the in-app browser with a mouse (month drag, map move/resize, quick add, rename, phone layout).
  **Touch long-press drag not tested on a real iPhone yet.**

## 0c. Update 2026-11-15, part 3
- Corner stretch: month chips have a right-edge handle (`.m-resize`, extends the end by whole days, keeps
  the end time); map timed events have a bottom-right corner (`.resize-corner`, same logic as the bottom
  handle: the column under the pointer sets the end day); map all-day events have a right edge (`.resize-edge`).
- Desktop (`DESKTOP_QUERY`): clicking an event opens the full EventSheet directly. On ≥900 px all sheets are a
  right-side panel. EventSheet: outside click / Esc → `dismissDraft` (saves edits of existing), "Anuluj" discards.
- `FEATURES.md` added (owner-facing description + feature log, in Polish). Keep it updated.
- Open idea: timed events ≥ 24 h could move to the all-day row like GCal does.

## 0d. Update 2026-11-15, part 4: sidebar + tags
- **Sidebar** (`Sidebar.tsx`): ☰ toggles it. Docked column on desktop (`DESKTOP_QUERY`, open state in
  localStorage `pulsecal:sidebar`), fixed drawer otherwise. Top `.side-actions` is where future function
  buttons go. On phones the mapa/miesiąc switch lives in the drawer (topbar had no room).
- **MiniCalendar**: pointer capture + `elementFromPoint`; same-day click → `onPickDay`, drag across days or
  week numbers → `onPickWeeks(start, n≤6)`. App holds `weekSel`; `mapDays` / `gridWeeks` derive from it,
  `CalendarMap` now takes `days` + `focusDay`, `MonthView` takes `weeks` + `month` (null = range, no dimming).
  ≤ 7 days → `.grid.fit` (columns fill width via `cqw`; `.map-shell` is a size container).
- **Tags** (`tags.ts`, `TagInput.tsx`): see CLAUDE.md conventions. `tagStats()` in db.ts reads the multiEntry
  index keys for the sidebar list. Hidden tags in localStorage `pulsecal:hidden-tags` (`__untagged__` = no tags).
  Round-trip of the description format was tested in the browser (plain, HTML from Google, `Tags:`, not-last-line).
- Gotcha seen while testing: Vite HMR can get stuck on a half-written module after several quick writes
  (`does not provide an export named …`). `touch` the file and reload.
- Not done yet: rename/delete a tag globally, custom tag colors.

## 0e. v0.6.0: editor popover at the cursor
- `SheetFrame.tsx` wraps QuickCard/EventSheet: with an `anchor` it renders a floating window placed by
  `useAnchoredPlacement` (`place()` = right of cursor, flip left, clamp vertically; measured with offset*).
  App records the last mouse `pointerdown` (capture) and passes it as anchor when `isDesktop` and recent.

## 1. Original state of `src/` (before this session) (the code you see)
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
