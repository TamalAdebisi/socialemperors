# Combat controls — 17 October 2026

Bull Gladiator's 1060 × 745 export canvas contains large transparent
borders. The unit click margin now follows the current visible frame in
town and battle, including mirroring, zoom and camera movement. Original
art size, exact-picture priority, the eight-pixel margin and 44-pixel
minimum remain.

The original attack sword appears over a live enemy when an armed unit
is selected. Shared controls refresh it for selection changes, moving
targets, a moving camera, aiming, pointer leave and battle end. The home
repair bucket keeps priority. No attack or availability rule changes.

## Revisions and checks

- Full Chromium: all 80 cases attempted in two isolated, alternating
  alphabetical 40-case shards at
  `5b544c2bb3241927576a6387453967d8a773a0a3`.
  Combined outcome: 70/80 passed, ten failed. Lane 1 finished 33/40 in
  115m 43.45s; lane 2 finished 37/40 in 99m 44.90s. Each shard has its own throwaway server/accounts,
  screenshots and log. Both use the same built game code and public-art
  cache. Nothing runs against the live game or the owner's account.
- Server: 449 run, 440 passed, nine existing PostgreSQL skips, 26.535s.
- Client: type check and all 408 tests passed; final repeat 35.040s.
- WebKit: corrected `combat-controls` passed in 89s at `4e030124`, using
  the pinned Playwright 1.56.1 Linux WebKit engine. The new test waits for
  home controls before inspecting the fixture. This is engine coverage,
  not evidence about macOS graphics drivers.
- Final isolated Chromium follow-ups: **10/10 passed in 15m 19.58s**
  at `daa2d2c7d423b8ade1ee2dd8f7d4e93510541faf`. All 80 browser cases
  have passing results across the full run and follow-ups, not one final-head
  80/80 run. After the full-run revision, runtime source differs only
  by a comment; the other changes are test waits/target selection. Final
  delivery edits are documentation only. Latest `origin/main` remains
  `dcd72818`; merging it reports already up to date.

The new original-art case checks visible Bull selection, a saved ground
move through its transparent canvas, battle selection and attack order,
the sword's CSS asset, stationary selection/camera updates, pointer leave
and stopped controls. Browser screenshots do not capture the OS cursor;
the exported sword was inspected separately and the case checks the
actual cursor style and attack target.

## Retained failures and follow-ups

The broad run is not described as one clean 80/80 pass. Failures stay in
the record even when a later focused run passes.

| Case | Full-run result | Evidence and follow-up |
| --- | --- | --- |
| animals | failed, 56s | Saved-state reads preceded the successful ranch arrival/batch. The test now waits for the sheep in local ranch state before retaining its six saved reads and both exact save assertions. Final isolated run passed (39s). |
| combat-controls | failed, 107s | First chosen raider was covered by the harbour; an eligible point could not be found. The test now searches exposed points across all eligible live enemies. WebKit passes; final isolated Chromium passed (47s). |
| contact | failed, 135s | Classic gamebar screenshot waited 30s for element stability. Link/order assertions had passed. No runtime or test change; final isolated run passed (168s). |
| construction | failed, 107s | Worker-arrival wait expired while software drawing was busy. Final save has the finished farm occupied by its villager and mission complete. Polling is now independent of animation frames at the same 15s deadline; no assertion is removed. Exact arrival/deadline order was not logged. Final isolated run passed (66s). |
| group | failed, 119s | Only two arrivals were in the last sampled save; final save has all four at distinct nearby tiles, with all movement commands recorded. No change to its rules or test. Final isolated run passed (109s); no unchanged-main reproduction is claimed. |
| neighbours | failed, 186s | Back-home flushes help before asynchronous navigation. `loaded()` could inspect the departing visitor document. Help/payment save checks passed; menu construction began after its locator deadline. Test now awaits the home navigation commit before the existing loaded check. Final isolated run passed (159s). |
| scripted-bosses | failed, 64s | Fight started, boss died and the expected two helpers/quest state saved. The end-of-fight wait timed out near the return transition under slow drawing. Exact crossing time is not logged. No runtime or test change; final isolated run passed (174s). |
| siege | failed, 58s | The wait for 1800 simulated frames expired after 30s. Formation/art are intact in the saved captures. No runtime or test change; final isolated run passed (40s). |
| walk | failed, 61s | The second local arrival wait expired at its 15s rAF deadline. Both moves were accepted and the final save contains the knight at the second destination. Exact movement/polling/deadline order is unresolved; no unchanged-main reproduction is claimed. Test and rules unchanged; final isolated run passed (50s). |
| survival | failed, 89s | The relic died, then the results-window selector expired after 15 wall seconds. The feature intentionally waits 90 simulated frames before results; no final frame diagnostic establishes the precise cause. The arena/control captures are intact and no end command is expected before results OK. Test and rules unchanged; final isolated run passed (51s). |

Earlier developer runs remain in `work/combat-focused.log`: the initial
combat target was obscured and the phone context lacked the bounds helper.
Those fixture corrections retain their assertions. Corrected individual
Chromium runs passed combat controls (83s) and desktop/phone controls
(119s). The full run independently passed desktop/phone controls (114s).
An earlier WebKit attempt failed because `seHome` was inspected before
ready; the explicit wait precedes the successful 89s run.

## Screenshot and server-log review

All 457 full-run PNGs were reviewed and reconciled with the final manifests:
318 in lane 1 and 139 in lane 2. Lane 1 has 37 scenarios with captures;
camp-again, keys and tidy produced none. Its structure gallery contains
203 captures: 199 facings from 98 sheets and four scenes. All recorded
gallery hashes match the final files. Lane 1's complete 32,630-line log
contains HTTP 200 × 13,076 and 106 expected registration/new-town redirects,
with no HTTP 4xx/5xx, tracebacks or error/unhandled patterns.

Lane 2: all 139 PNGs across 38 scenarios were reviewed and reconciled with
the final manifest. Two cases (scripted-stories and town-rules) generated
no screenshots and have no visual claim. Its complete 35,549-line server
log contains HTTP 200 × 12,668 and 302 × 106, with no HTTP 4xx/5xx,
Python traceback, ERROR or unhandled/unknown command after ANSI stripping.

All 36 final focused PNGs across the ten completed cases were reviewed
and reconciled by exact file/hash manifest (34 independent review, two
root controls review). No missing files, unmatched hashes or zero-image
cases remain. The complete final server log has 11,575 lines / 1,047,573
bytes: HTTP 200 × 2,792 and 28 expected redirects (14 registration,
14 new-town). ANSI-stripped scanning found no HTTP 4xx/5xx, traceback,
exception, error, unhandled, uncaught, fatal, critical, broken-pipe or
connection-reset pattern. The local Flask development-server startup
warning is expected. Final log SHA-256:
`7f6d641eb4ad8ab04c62059bae0ac1f24d3015b234d653cc665bfa71fced3568`.

Lane/focused ledgers identify every reviewed PNG path and distinguish
full-image/contact-sheet inspection. Known limits include Ruffle overlays
and blank desktop shop thumbnails already recorded by #96; later phone-shop
art loads. Original large art can crop the viewport. The sheep capture
precedes its later delivery assertion. A static screenshot does not prove
all earlier brief effects or attack timings. No new visual regression was
identified. Browser cursor pixels are not claimed captured.

This machine has a two-CPU quota and 8 GiB memory limit. It reached the
memory limit/reclaim counter during parallel browser runs, with no OOM
or OOM-kill recorded. Performance is a possible contributor to
timeouts, not proof that every failure is unrelated.

## Remaining combat slices

This controls slice does not complete the combat workstream:

1. Protection Dome, Tower Enhancer and specialized tower behavior.
2. Last-island team ownership from contained units, storage and warehouse,
   with real quest casualty persistence.
3. Targeted rare moves: the research table has 43 entries with 66 explicit
   remaining requirements. Existing death/step hooks are reused.
4. Squad regrouping, archer retreat and small shot/tower timings.
5. Original-game comparison where permitted. Existing comparison and
   feature holds remain in force.

Medusa Barracks (1267, level 8, 30 cash, trains 749) is hidden by the base
`in_store: 0` setting. This slice leaves that availability decision alone.
Collection kill drops and Blue Phoenix rebirth need coordination with the
separate menus/progression workstream.

## Full-run case ledger

The following timings belong to the full-run revision and retain its ten
failures. The table above records their later passing checks.

| Case | Lane | Full result | Seconds |
| --- | --- | --- | ---: |
| animals | 1 | FAILED | 56 |
| attack | 2 | ok | 421 |
| battle-selection | 1 | ok | 118 |
| bonus | 2 | ok | 60 |
| bosses | 1 | ok | 77 |
| bubble | 2 | ok | 84 |
| building-overlay | 1 | ok | 185 |
| camp | 2 | ok | 89 |
| camp-again | 1 | ok | 51 |
| card | 2 | ok | 236 |
| cash | 1 | ok | 63 |
| classic | 2 | ok | 85 |
| collect | 1 | ok | 116 |
| collections | 2 | ok | 51 |
| combat-controls | 1 | FAILED | 107 |
| construction | 2 | FAILED | 107 |
| contact | 1 | FAILED | 135 |
| defence | 2 | ok | 57 |
| dock | 1 | ok | 110 |
| dragons | 2 | ok | 175 |
| edit | 1 | ok | 97 |
| friends-help | 2 | ok | 178 |
| gifts | 1 | ok | 137 |
| goal-window | 2 | ok | 149 |
| graveyard | 1 | ok | 52 |
| group | 2 | FAILED | 119 |
| heroes | 1 | ok | 83 |
| hover | 2 | ok | 63 |
| keys | 1 | ok | 68 |
| lessons | 2 | ok | 292 |
| lessons-phone | 1 | ok | 419 |
| lessons-recovery | 2 | ok | 141 |
| levelup | 1 | ok | 99 |
| look | 2 | ok | 111 |
| looks | 1 | ok | 236 |
| market | 2 | ok | 126 |
| menus | 1 | ok | 334 |
| messages | 2 | ok | 38 |
| monks | 1 | ok | 37 |
| nature | 2 | ok | 51 |
| neighbours | 1 | FAILED | 186 |
| nests | 2 | ok | 162 |
| phone-place | 1 | ok | 137 |
| playthrough-controls | 2 | ok | 114 |
| pointers | 1 | ok | 150 |
| quest | 2 | ok | 337 |
| raids | 1 | ok | 135 |
| recurring-raids | 2 | ok | 54 |
| rename | 1 | ok | 86 |
| scripted | 2 | ok | 163 |
| scripted-bosses | 1 | FAILED | 64 |
| scripted-stories | 2 | ok | 203 |
| selected | 1 | ok | 133 |
| shop | 2 | ok | 94 |
| siege | 1 | FAILED | 58 |
| site-menu | 2 | ok | 216 |
| sound | 1 | ok | 62 |
| specials | 2 | ok | 47 |
| speed | 1 | ok | 43 |
| spells | 2 | ok | 108 |
| spy | 1 | ok | 97 |
| storage | 2 | ok | 85 |
| structure-idle | 1 | ok | 1844 |
| stuck | 2 | ok | 86 |
| survival | 1 | FAILED | 89 |
| team | 2 | ok | 101 |
| tidy | 1 | ok | 113 |
| tools | 2 | ok | 131 |
| tournament-battle | 1 | ok | 421 |
| tournament-results | 2 | ok | 420 |
| tournament-rooms | 1 | ok | 274 |
| tournament-weekly | 2 | ok | 323 |
| tournaments | 1 | ok | 133 |
| town-rules | 2 | ok | 68 |
| train | 1 | ok | 37 |
| troll-town | 2 | ok | 82 |
| villagers | 1 | ok | 85 |
| walk | 2 | FAILED | 61 |
| work | 1 | ok | 57 |
| world | 2 | ok | 395 |
