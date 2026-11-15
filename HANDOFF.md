# HANDOFF: Pulsecal work status (2026-11-15)

## TODO (owner's list)
- [ ] **Conflict handling between Google Calendar and the local DB.** Today it is last-writer-wins
  (`applyRemote` in `sync/google.ts`: local `updatedAt` vs Google `updated`), so a simultaneous edit on
  both sides silently loses one version. Build a real system:
  1. Detect: local entry is `pending` AND Google's etag differs from the last synced `googleEtag`
     (both sides changed since the last sync) → conflict, instead of picking the newer one.
  2. Merge what can be merged field by field (title / time / notes / tags / colour) when only different
     fields changed; that needs the last synced snapshot (store it, e.g. `syncBase` on the event).
  3. Real conflicts: keep both versions (e.g. `conflict` field with the remote copy), mark the entry in
     the UI, let the owner pick „moja / z Google / połącz”; don't push until resolved.
  4. Edge cases: deleted on one side + edited on the other; recurring instances; the same event edited on
     two devices (both push to Google).
  5. A small log of resolved conflicts (for trust/debugging).
- [ ] **Month view: day popup + "triage" of a day's events** (don't open the map for "+N więcej").
  1. "+N więcej" opens a popup with **all** events of that day (instead of switching to the map/week).
  2. Every day that has any event gets a small button at the bottom of its cell that opens an
     **analysis/triage mode** for that day: a list of the day's events, each with
     `>` = move to the next day and `>>` = move by 7 days (keep the time of day; all-day stays all-day).
  3. A general button **„> wszystkie niepilne”** that moves to the next day every event of that day that
     has neither the tag `pilne` nor `ważne`.
  Notes: moves go through `saveLocal` (pending → sync) like drag & drop; an undo toast would be welcome;
  this is also a natural ADHD feature (low-friction rescheduling).
- [ ] **Default tag „ważne”**: added automatically to every event whose title starts with `!`
  (e.g. „!zapłacić czynsz”). Decide: strip the `!` from the title or keep it; apply on save in the app
  (QuickCard / EventSheet / quick add) and also to events pulled from Google; don't remove the tag again
  if the user deletes it manually later (only add on create / when the `!` is newly added).
- [ ] **Month view: alphabetical order of events within a day** (by title, Polish collation:
  `localeCompare(…, "pl")`).
- [ ] **Month view: timed events (not all-day) shown first**, all-day after them.
  Today `layoutWeek()` in `MonthView.tsx` does the opposite: bars (all-day / multi-day) first, then timed
  by start time. Notes for both items:
  - decide the order *inside* the timed group: alphabetical (item 3) or by time — ask the owner;
  - multi-day bars span several days and must keep one lane across the week, so a per-day sort can't
    fully apply to them; simplest: timed single-day first (sorted), then all-day/multi-day bars below
    (sorted alphabetically), lanes assigned in that order.
- [ ] **Right-click context menu on an event** (desktop): small popup at the cursor (reuse
  `useAnchoredPlacement`) with **Usuń**, the **colour** swatches and **tags** (toggle existing tags, add a new
  one). Changes save immediately via `saveLocal` + `requestSync`. Esc / click outside closes. On touch the
  long-press is already drag, so a phone equivalent needs a separate decision (e.g. the quick card).
- [ ] **Tag dots on every event**: each tag shown as a small dot in the tag's colour (`tagColor`) on the
  event in all views (map blobs, month chips, all-day bars) — replaces the text line `.blob-tags` in the map.
- [ ] **Hover delete button on every event** (desktop, `@media (hover: hover)`): a small × that deletes
  immediately, **no confirmation** (owner's wish: less menu diving). Must not start a drag or open the editor
  (stopPropagation on pointerdown/click). Strongly suggested: an „Cofnij” (undo) toast instead of a
  confirmation, since `removeLocal` of a Google-synced event becomes a DELETE in Google on the next sync —
  undo must restore the record before that sync runs (or re-create it).
- [ ] **„miesiąc” button must always be visible.** Cause: with a week range picked in the mini calendar,
  App renders the grid chip as `gridLabel` = „2 tyg.” instead of „miesiąc” (topbar on desktop, drawer on
  phone), so the month option seems to disappear. Fix idea: always show „mapa” + „miesiąc”; clicking
  „miesiąc” clears `weekSel` and shows the month of `focus`; show the active range as its own extra chip
  („2 tyg. ×”) next to them.
- [ ] **Colour sync Google → Pulsecal must be faithful** (red in GCal → red/similar in Pulsecal).
  Current state (`remoteColor()` in `sync/google.ts`, `GOOGLE_COLOR_MAP` in `colors.ts`): an event's
  `colorId` (1–11) maps to the nearest of our 6 palette colours; our own `pulseColor` wins only if `colorId`
  still matches it. Gaps to fix/check:
  - events **without `colorId`** use the *calendar's* colour in Google, but we show the default „sky” blue →
    read the calendar's `backgroundColor` (calendarList, already fetched in `listCalendars()`) and use the
    nearest palette colour as the default;
  - colours with no close match (Graphite „8” → `#c4b5a5` is not in the palette, so `colorInk` falls back;
    Grape vs Lavender, Basil vs Sage collapse) → either extend the palette with Google's 11 colours or pick
    nearest by real colour distance;
  - check with a real Google account: change the colour in GCal → after a sync the event changes colour in
    Pulsecal (the etag changes, so `applyRemote` re-applies it), and back.
  - **Owner's observation (most important):** events that have a GCal *colour label* (Google lets you name
    the event colours, e.g. „Praca” = Tomato) get the wrong colour in Pulsecal. In the API a label is still
    just the event's `colorId` (the names live in the user's settings), so the mismatch is in our mapping:
    fetch the real hex values from `GET /colors` (`event` palette) once, map by actual colour distance (or
    keep the exact hex), and log `colorId` → our colour for a few mis-coloured events to confirm. Check also
    that such events aren't keeping a stale `pulseColor` from an earlier push (it wins when `colorId` matches).
- [ ] **Dark mode toggle**: a switch (auto / jasny / ciemny, default auto = `prefers-color-scheme`), stored
  in localStorage, applied as `data-theme` on `<html>`. Needs: dark values for the `:root` variables
  (`--paper`, `--ink`, `--glass`…), replacing hard-coded light colours (`#fffaf2`, `#efe8dc` in `.sheet`,
  `.field`, `.tag-box`, `.search-box`, `.mini-chip`, toasts…), event colours readable on dark (blob
  background mix with black instead of white), the PWA `theme-color` meta. Place: settings sheet or sidebar.
- [ ] **Date picker: Monday as the first day of the week.** The editor uses native `<input type="date">` /
  `datetime-local`; their popup calendar follows the browser/OS locale, not the page (Chrome on an English
  Windows starts on Sunday; `lang="pl"` on `<html>` doesn't change it reliably). The mini calendar and the
  month view already start on Monday. Options: a small custom picker built from `MiniCalendar` (consistent
  look, Monday first, works with our blob style) for date + a time field/chips for the time; keep native
  inputs on iOS where the wheel picker is good and has no week grid.

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

## 0f. v0.7.0: scrolling through dates + „dziś”
- App keeps `mapStart` (map window, 42 days) separate from `focus`. `navigate(day)` = every explicit jump
  (focus + window around it + scroll token). `onEdge` shifts the window by 14 days; `onVisibleDay` makes
  `focus` follow the first visible day (label, mini calendar, arrows start from there) without re-scrolling.
- CalendarMap: the scroll check is synchronous arithmetic (no rAF — a hidden browser pane doesn't run rAF
  or deliver scroll events, which made testing misleading). After a window shift the same day is put back
  at the same offset (absolute, `keep` ref) — a relative "-14 columns" double-compensated in Chrome because
  scroll-snap re-snaps after DOM changes. Initial/navigation scroll runs in a layout effect.
- Wheel: native non-passive listener on the map (headers/all-day → horizontal; weekSel → `onStep` at edges,
  one gesture = one step via a lock that extends while inertia events keep coming). MonthView: React onWheel
  + vertical swipe (capture phase, so chip drag handlers don't swallow it) → `onStep`.
- Testing tip: in the hidden pane, dispatch `new Event('scroll')` / `WheelEvent` manually.

## 0g. v0.8.0: search + quick add (HANDOFF step 7 done)
- `SearchSheet.tsx` (SheetFrame variant "palette"): `searchEvents()` (now also matches tags) or the next 8
  upcoming events; first row "Utwórz …" from `parseQuickEntry()` (`quickParse.ts`). Default Enter: create if
  the text had a date/time (`hasWhen`) or there are no results, otherwise open the first result.
- App: dock pill = search, separate "+" = blank entry; "/" opens search; `createFromSearch` saves directly,
  jumps to the day and toasts (warns if a tag filter hides it).
- Parser checked in the browser on 12 phrases (see CHANGELOG 0.8.0 examples). Known choices: an ambiguous
  `#prefix` becomes a new tag; a past "d.m" date without a year goes to next year; "nie" is not Sunday.
- Remaining HANDOFF steps: 5 (touch drag polish on iPhone), 6 (swipe-down to close sheets, duration chips,
  origin badge), 8 (dark mode, more shortcuts), 9 (README about re-login / backend option).

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
