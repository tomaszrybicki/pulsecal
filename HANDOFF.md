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
- [x] **Month view: day popup + "triage" of a day's events** (don't open the map for "+N więcej").
  1. "+N więcej" opens a popup with **all** events of that day (instead of switching to the map/week).
  2. Every day that has any event gets a small button at the bottom of its cell that opens an
     **analysis/triage mode** for that day: a list of the day's events, each with
     `>` = move to the next day and `>>` = move by 7 days (keep the time of day; all-day stays all-day).
  3. A general button **„> wszystkie niepilne”** that moves to the next day every event of that day that
     has neither the tag `pilne` nor `ważne`.
  Notes: moves go through `saveLocal` (pending → sync) like drag & drop; an undo toast would be welcome;
  this is also a natural ADHD feature (low-friction rescheduling).
- [x] **Default tag „ważne”**: added automatically to every event whose title starts with `!`
  (e.g. „!zapłacić czynsz”). Decide: strip the `!` from the title or keep it; apply on save in the app
  (QuickCard / EventSheet / quick add) and also to events pulled from Google; don't remove the tag again
  if the user deletes it manually later (only add on create / when the `!` is newly added).
- [x] **Month view: alphabetical order of events within a day** (by title, Polish collation:
  `localeCompare(…, "pl")`).
- [x] **Month view: timed events (not all-day) shown first**, all-day after them.
  Today `layoutWeek()` in `MonthView.tsx` does the opposite: bars (all-day / multi-day) first, then timed
  by start time. Notes for both items:
  - decide the order *inside* the timed group: alphabetical (item 3) or by time — ask the owner;
  - multi-day bars span several days and must keep one lane across the week, so a per-day sort can't
    fully apply to them; simplest: timed single-day first (sorted), then all-day/multi-day bars below
    (sorted alphabetically), lanes assigned in that order.
- [x] **Right-click context menu on an event** (desktop): small popup at the cursor (reuse
  `useAnchoredPlacement`) with **Usuń**, the **colour** swatches and **tags** (toggle existing tags, add a new
  one). Changes save immediately via `saveLocal` + `requestSync`. Esc / click outside closes. On touch the
  long-press is already drag, so a phone equivalent needs a separate decision (e.g. the quick card).
- [x] **Tag dots on every event**: each tag shown as a small dot in the tag's colour (`tagColor`) on the
  event in all views (map blobs, month chips, all-day bars) — replaces the text line `.blob-tags` in the map.
- [x] **Hover delete button on every event** (desktop, `@media (hover: hover)`): a small × that deletes
  immediately, **no confirmation** (owner's wish: less menu diving). Must not start a drag or open the editor
  (stopPropagation on pointerdown/click). Strongly suggested: an „Cofnij” (undo) toast instead of a
  confirmation, since `removeLocal` of a Google-synced event becomes a DELETE in Google on the next sync —
  undo must restore the record before that sync runs (or re-create it).
- [x] **„miesiąc” button must always be visible.** Cause: with a week range picked in the mini calendar,
  App renders the grid chip as `gridLabel` = „2 tyg.” instead of „miesiąc” (topbar on desktop, drawer on
  phone), so the month option seems to disappear. Fix idea: always show „mapa” + „miesiąc”; clicking
  „miesiąc” clears `weekSel` and shows the month of `focus`; show the active range as its own extra chip
  („2 tyg. ×”) next to them.
- [x] **Colour sync Google → Pulsecal must be faithful** (red in GCal → red/similar in Pulsecal).
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
- [x] **Dark mode toggle**: a switch (auto / jasny / ciemny, default auto = `prefers-color-scheme`), stored
  in localStorage, applied as `data-theme` on `<html>`. Needs: dark values for the `:root` variables
  (`--paper`, `--ink`, `--glass`…), replacing hard-coded light colours (`#fffaf2`, `#efe8dc` in `.sheet`,
  `.field`, `.tag-box`, `.search-box`, `.mini-chip`, toasts…), event colours readable on dark (blob
  background mix with black instead of white), the PWA `theme-color` meta. Place: settings sheet or sidebar.
- [x] **Date picker: Monday as the first day of the week.** The editor uses native `<input type="date">` /
  `datetime-local`; their popup calendar follows the browser/OS locale, not the page (Chrome on an English
  Windows starts on Sunday; `lang="pl"` on `<html>` doesn't change it reliably). The mini calendar and the
  month view already start on Monday. Options: a small custom picker built from `MiniCalendar` (consistent
  look, Monday first, works with our blob style) for date + a time field/chips for the time; keep native
  inputs on iOS where the wheel picker is good and has no week grid.
- [ ] **P2 – Undo button for the last action**: a persistent „Cofnij” (e.g. in the topbar or the dock, plus
  Ctrl/Cmd+Z) that undoes the most recent change — move, resize, delete, edit, tag/colour change, day triage —
  not only while the toast is visible. Today undo exists only in the toast after delete and day-panel moves
  (`deleteEvent`, `shiftEvents` in App). Idea: a small undo stack of `{ label, before: CalEvent[] }`
  snapshots taken before every `saveLocal`/`removeLocal` from the UI; undo = put the snapshots back
  (re-create with a new id if a deletion already reached Google, as `deleteEvent` does).
- [ ] **P2 – Silent reconnect after the 1 h token expiry** (no backend): when the token has expired, the
  user's next click anywhere calls `connectGoogle()` (prompt "") inside that gesture — usually just a short
  popup flash. The full fix (log in once) needs a small backend with refresh tokens — ask the owner first.
- [x] **P2 – Tag rules**: rules like „title (or notes) contains word X → add tag Y” (e.g. „dentysta” →
  `wizyta`). Edited in the sidebar under the tag list / in settings. Apply on save in the app (QuickCard,
  EventSheet, quick add) and to events pulled from Google; only *add* tags (never remove), and don't re-add
  a tag the user removed by hand from that event. Match case-insensitively on whole words, Polish letters
  included. The planned „!” → `ważne` rule can become the first built-in rule.
- [x] **P2 – Back up app settings in Google Calendar**: settings are growing (hidden tags, tag rules, poll
  interval, sidebar, future theme / tag colours), so store a copy as one hidden event with a parseable
  description (JSON in a fenced block + a human note „Ustawienia Pulsecal — nie usuwaj”).
  - Hide it: all-day event on a fixed far date (e.g. 1 Jan 2000 or 10 years ahead), `transparency:
    transparent`, `visibility: private`; fixed event id (e.g. `pulsecalsettings0`) so it is read/written
    directly by id; skip it in pulls/search/views (filter by that id).
  - Never store the OAuth token; the Client ID is needed before we can read the backup anyway.
  - On a new device: after connecting, offer „Przywróć ustawienia z Google?”. Conflicts: newest
    `updatedAt` wins (whole-object), writes debounced.
- [x] **Tags with uppercase letters** (e.g. „ADHD”, „Praca”). Today `normalizeTag()` in `tags.ts` lowercases
  everything. Change: keep the casing the user typed for display, but compare case-insensitively —
  key = `toLocaleLowerCase("pl")` for dedupe, the hidden-tags filter, `tagColor()`, `#prefix` matching in
  quick add and the Dexie `*tags` index (store tags as typed; `tagStats()` groups by key and shows the most
  common casing). „Praca” and „praca” on two events = one tag. The Google line „Tagi: …” keeps the casing.
  Existing tags are all lowercase, so no migration needed; update the CLAUDE.md convention line.

Versions and commits: see `CHANGELOG.md` and the "Versions and commits" section of `CLAUDE.md`.

Previous sessions: first Cursor IDE (built the MVP), then Claude in a chat session, which did the
code audit and rewrote the data and sync layer, then stopped at the owner's request.
**Start by reading `CLAUDE.md`.**

## v0.36.0: hold "zaplanuj" to drag a task onto the calendar, "?" estimate
- `PlanButton` (TasksView, also used in WorkItemSheet): click → `onPlan`; hold `HOLD_MS` 380 without moving →
  `onPlanHold(task, x, y)` → App `startPlanDrag`.
- App plan drag: switches to `lastCalView`; TasksView stays mounted inside `.tasks-host` (display none) so the
  pressed element stays in the DOM (touch keeps its pointer); `body.plan-dragging` hides sheet backdrops.
  Window pointermove / pointerup / pointercancel / Esc. Drop target via `elementsFromPoint` → `[data-day]`
  (`.m-day`, `.allday`, `.hours`; `.hours` → minutes from y). Drop → draft (all-day or timed) with
  `taskId` / title / epic, anchored at the drop point. `.plan-over` marks the hovered day, `.plan-ghost` follows.
- `UNKNOWN_ESTIMATE` (-1) is draft-only; `storedEstimate()` drops it when saving (saveDraft, EventMenu).
- Estimate picker moved right under the title (QuickCard, EventSheet).

## v0.35.0: P never in the past, "zaplanuj" on task rows
- `planEvent` / `planDraft` search from `max(event day, today)`; `findFreeSlot` already starts at now for today.
- `WhenChip onPlan` → „+ zaplanuj” for unscheduled, not-done tasks (TasksView list, prop `onPlanTask`);
  WorkItemSheet epic contents rows have the same button (`.wk-open` + `.jr-plan`).

## v0.34.0: map restyled like Google Calendar
- Flat grid: `.map-scroll` overrides at the end of index.css (`--map-line`, `--today-tint`, `--past-tint`);
  heads / band / hours share a 1px `border-left` per day, heads and band are opaque (no bleed-through).
- `dayClass(d)` → " today" / " past" on `.day-head`, `.allday`, `.hours`; past events dimmed.
- Head markup: `.dh-wd` + `.dh-num` (formatDayHeading no longer used here).
- `snapTo` scrolls to the day *before* the focus day (yesterday next to today). With a week selection the
  range starts at its own first day, so yesterday may be outside it.
- Band collapse: `.band-toggle` (`pulsecal:allday-collapsed`, collapsed height `BAND_COLLAPSED_H` 64 px).

## v0.33.0: time estimate on entries
- `CalEvent.estimate` / `DraftEvent.estimate` (minutes; 120 = "2h+"), Google `private.pulseEst` (always sent,
  "" clears). `EstimatePicker` in QuickCard (no label), EventSheet („Estymata”), EventMenu (`onPatch`).
  `EstSuffix` after titles in map / month / day panel.
- `prefs.ts getRequireEstimate()` (`pulsecal:require-estimate`, in settings backup): new drafts can't be saved
  without an estimate (QuickCard/EventSheet `needEst`, `saveDraft` guard); `createFromSearch` opens a draft
  instead of saving directly.
- `work.ts remainingEstimate()` → `Remaining` (TasksView group head, WorkItemSheet) and pinned epics
  (`PinnedEpic.remaining`); `WhenChip` / „kalendarz” field show the estimate.

## v0.32.0: map — sticky all-day band, centred on now, orbit dot, short events
- CalendarMap: `.allday` cells and `.allday-gutter` are sticky under the day heads (`--head-h` = `HEAD_H` 50,
  `--allday-h` = ratio × (scroller height − heads), ResizeObserver). Ratio in `pulsecal:allday-ratio`
  (0.1–0.8, default 0.5), `band-grip` drag / double-click reset. `.map-corner` covers hour labels at top-left.
  Wheel over an overflowing band scrolls the band. Drag auto-scroll top edge = heads + band.
- `snapTo` centres now's time-of-day in the visible hours (below the band); also re-runs once after the first
  height measurement.
- Timed blobs: `blobHeight()` = real height − 2 px gap, min 16 px; `< SHORT_BLOB_H` → `.short` single line.
- Now dot: `.now-orbit` wrapper (translate + scale keyframes) around `.now-blob` (morph), `.now-orbit-ring`.

## v0.31.0: epics contain only tasks; tasks may have calendar events
- `WorkItem.eventId` / `seriesId` / `statusManual` (all in the item backup). `DraftEvent.taskId` („zaplanuj” on a
  task: `saveDraft` links the task *before* saving the event so reconcile doesn't create a second task).
- `links.ts reconcileLinks(now)` (App effect on items / epicEvents / linkedEvents / minute tick, serialized with
  refs): event with epic and no task → task with id `linkedTaskId("ev:"+id)` / `("series:"+sid)` (revives a
  soft-deleted one). Pair diverged → newer `updatedAt` wins; event newer with no epic → task dropped. Auto status
  for single-event tasks. Series: task wins; instances get `epicId` via `db.events.put` (never pushed); only
  instances with an explicit epic newer than the task can move it. `unlinkSeries()` when an instance's epic is
  cleared in UI (saveDraft / patchEvent).
- `buildTree(items, events)`: `tree.events` = task id → linked events. `progressOf` counts tasks only.
  App passes `epicEvents` + `linkedEvents` (bulkGet of task eventIds).
- `deleteWork` runs in one Dexie transaction (clears linked events' epic) so reconcile can't revive the task.
- UI: `WhenChip` (TasksView rows/cards), `HelpButton` „?”, WorkItemSheet „kalendarz” field, auto-status hint.
- Hover: `.m-ev:hover` / `.allday-blob:hover` get extra right padding (epic tag slides left, buttons free).
  Dark theme: thicker outline on `.m-ev.timed`.

## v0.30.0: default tags, "low priority" day move, P rolls to the next day
- `tags.ts`: `LOW_PRIORITY_TAG`, `DEFAULT_TAGS` (with default colours used by `tagColor` when no custom colour),
  `withDefaultTags()` merges them into App's `tagList` (count 0) → sidebar + suggestions.
- DayPanel: `isLowPriority`; „> wszystkie low priority” shifts only those (rows get `.low`).
- P click (`planEvent`/`planDraft`) uses `slotFrom()` = `slotOn()` for the day and then up to 13 following days;
  a different day counts as a move (`countMove` + threshold prompt). Day moves of P events (drag, „>”)
  still use the target day only.

## v0.29.0: dev test data
- `devSeed.ts`: `seedTestData()` (re-creates), `clearSeed()`, `hasSeed()`. Events and items get ids starting
  with `SEED` = "5eed" (still 32 hex, valid Google ids) and `pending: 0`, so they stay local until edited.
  Dates are relative to today. UI: `DevSeed` section in `PrefsSheet`, rendered only when `import.meta.env.DEV`
  (tree-shaken out of the production bundle — checked).
- Use it for browser checks instead of hand-made `test-*` rows.

## v0.28.0: P on every day move, × on popups, clickable epic label
- `moveEvent` re-slots P events on any day change (map drags too); `saveDraft` re-slots when the date of an
  existing P event changed in the editor. `useOptimisticMove` now drops its override as soon as the DB row
  differs from the pre-drop position (re-slotted events used to show the dropped time for up to 4 s).
- `SheetFrame closable` → `.sheet-x` (calls `onDismiss`): QuickCard, EventSheet, EventMenu, DayPanel.
- DayPanel `onPlan` (P button per row, always shown). `EpicOpenContext` (App `openEpicFromTag`) makes
  `EpicTag` a clickable span (stops pointerdown so it doesn't start a drag).
- Move threshold was already "every N" (`crossesThreshold`); only the settings wording changed.

## v0.27.0: settings sheet, "P" auto-slot, epic combobox, filled month chips
- `prefs.ts` + `PrefsSheet` (sidebar „ustawienia”): productive hours (`pulsecal:prod-from/to`, minutes),
  P slot length (`pulsecal:slot-min`), move threshold (moved out of `SettingsSheet`), always-full editor
  (`pulsecal:always-full`, per device; App `editorMode`). Hours + slot are in the settings backup.
- Move threshold crossed → `promptMoved()`: warn toast + full editor with `stuck` (hint, title autofocus).
  `MovePrompt` and the steps helpers were removed.
- `CalEvent.autoSlot` („P”, Google `private.pulseAuto` "1"/"" always sent). `PlanBtn` (DelBtn.tsx) on hover in
  map/month (`eventActions.onPlan`, desktop), `plan-toggle` in EventSheet (`planDraft`). `findFreeSlot()` =
  earliest gap in productive hours avoiding timed events (today: from now, 5-min steps). Re-slot on day
  moves only: `moveEvent(..., reslot=true)` from MonthView and `shiftEvents`; map drags keep the dropped time.
- `EpicPicker` is a combobox (input + in-flow `.ep-list`): Enter picks exact/highlighted epic or creates one.
- Month view: non-bar chips get `.timed` (filled + inset outline).

## v0.26.0: "2 tyg." view chip, default view
- `ViewChip` (bottom of App.tsx): chip + hover star `chip-default`. „2 tyg.” = `weekSel {start: startOfWeek(focus),
  weeks: 2}` + month view; the extra „N tyg.” chip shows only for other selections.
- Default view per device in localStorage `pulsecal:default-view` ("map" | "month" | "2w"), read once for the
  initial `view` / `weekSel` state. Not in the settings backup on purpose.

## v0.25.0: sidebar feature links, pinned epics
- Sidebar is a flex column; `.side-nav` (margin-top: auto) at the bottom: „kalendarz” (back to `lastCalView` ref
  in App), „zadania i epiki” (open task count), „motyw” (theme seg). The „zadania” chip left the top bar.
  New features should get a link here.
- `WorkItem.pinned` (item backup). Pin: `jr-epic-pin` in `EpicPanel` (via `onPatch`), `ji-pin` in
  `WorkItemSheet` (`saveNow`, saves immediately). Sidebar `PinnedRow`: task ratio → `progressColor()`;
  `almost` (≥ `ALMOST_DONE` 0.8) pulses; `sleepy` = `lastTouched()` (max `updatedAt` in the subtree) older
  than `SLEEPY_DAYS` 7 → breathing bar + floating zZz. Reduced motion → static.
- Note: the PC-N numbering migration re-saves items without `num` (bumps `updatedAt`).

## v0.24.0: comments on tasks and epics
- `WorkItem.comments?: WorkComment[]` (`{id, text, at, edited?}`), stored newest first; in the item backup JSON
  (`ItemData.comments`, validated in `parseItem`). The whole item JSON lives in one event description, so very
  long comment threads make that description big (not tested against Google's size limit).
- `Comments.tsx` in `WorkItemSheet`: comment changes save immediately (`setComments` → `onSave`); the unsent
  draft is kept in the sheet (`note`) and `commit()` turns it into a comment on close/navigation.
- `CommentCount` (exported from `TasksView`) on list rows and board cards; task search includes comments.

## v0.23.0: Jira-like tasks view, priority & custom fields
- `TasksView` rewritten: `EpicPanel` (filter), toolbar (search, group, sort, hide done, "pola"), `ListView`
  (CSS-grid table, groups by epic/status/priority), `BoardView` (HTML5 drag & drop between status columns;
  touch has no drag — status is changed in details). View prefs in localStorage (`pulsecal:jira-*`).
- `WorkItem`: `num` (key `PC-N`, `nextNum` + `lastNum` ref against duplicates; old items numbered once by an
  effect in App), `priority`, `due` (local midnight), `estimate`, `fields` (custom values). All in the item backup.
- Custom field definitions: `work.ts` `getWorkFields/setWorkFields` (`pulsecal:work-fields`), settings backup
  `workFields`.
- `patchItem(id, patch)` in App chains writes and reads the current DB row (fast clicks don't lose updates).
- Old `.wk-row`/`.tasks-*` CSS from v0.22 is now unused (left in `index.css`).

## v0.22.0: tasks and epics („zadania”)
- New view `tasks` (`TasksView`), details `WorkItemSheet`, model in `work.ts`, Dexie v4: `items` table +
  `epicId` index on events. Events get `epicId` (EventSheet field, EventMenu select, label via `EpicTag`).
- Progress = done tasks + past linked events, recursive over sub-epics (`progressOf`).
- Google backup: one hidden event per item (see CLAUDE.md conventions). Deletions travel via cancelled events
  (`showDeleted=true`), never by absence. Tested in the preview without Google; **not tested against real
  Google** (item backup, `pulseEpic` on events).
- Ideas not built: drag & drop ordering, due dates on tasks, a kanban board by status.

## v0.21.0: rename tag, „koloruj”, dots on the left
- Sidebar tag name is a button → inline input; `renameTag(from, to)` in App rewrites every event with that
  tag key (all dates; recurring instances local-only), moves hidden filter / custom colour / paint flag / rules,
  undo restores snapshots. Same-key rename = casing change only.
- `tags.ts`: paint tags (`pulsecal:tag-paint`, in settings backup as `paintTags`). `shownColor(e)` is display
  only — views use it instead of `e.color`; never save it into the event.
- `TagDots` now sits before the title (month chips, map blobs).

## v0.20.1: recurring series changed in Google
- Bug: a series edited in GCal („all events”) didn't show in Pulsecal. Incremental pull used `singleEvents=true`
  + `updatedMin`; changing the series time changes instance IDs, so old copies stayed until the 10-min full pull.
  Also tag rules / „↻” PATCHed instances, which detached them from the series in Google.
- Fix: `pullSince` lists changes with `singleEvents=false` (no time bounds); a master with `recurrence` →
  `reconcileSeries(masterId, meta.from, meta.to)`; a cancelled master → `dropSeries`. Instances store `seriesId`.
  Rule tags on instances are local only (`pending: 0`), also in `applyRulesToAll`.
- Not verified against real Google (only `npm run build`). Instances detached earlier stay detached in Google.

## v0.20.0: refresh tags + „!” as a rule
- `TagRule.kind`: `"word"` (default, whole word in title/notes) or `"start"` (title starts with). `ruleMatches(rule, title, notes)`.
- `autoTags()` is gone; „!” → `ważne` is `DEFAULT_RULES[0]` (`id: "default-bang"`), added once per device
  (`pulsecal:tag-rules-defaults`). Old settings backups (no `rulesV`) get it re-added on restore.
- Sidebar „↻” and the rules sheet button run `applyRulesToAll`: events with `end >= start of today`, undo toast.
- Right-click menu (`EventMenu`) has an „OK” button that closes it.

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
