# Click-only item details: verification for #113

The owner requested explicit item details at every screen width and a fix
for overflowing Details labels. This follow-up removes automatic hover and
focus opening from the shared Shop/Storage window. Visible buttons say
Details; accessible names still identify the item. Buying, placing and
selling keep their existing actions.

The resize checks also exposed a unit-preview clock bug. A delayed first
animation callback can carry an earlier timestamp than setup. Negative
elapsed time selected a negative animation index. The browser stack mapped
to that exact operation in the compiled preview; an isolated test reproduced
the same exception against the actual renderer. Clamping elapsed time to
zero fixes the first frame while preserving animation order and speed.

## Revisions and checks

Full-run game, browser fixtures, preview regression and loaded runner:
`e333f8c945a2d0008835d5be3808c9d7fdebcebf`. The main branch at the start
and before that run was `a0f3ab19`.

During the run, main #114 (`f9946077`) was integrated in `5e080221`.
Both decisions were retained, newest first. That merge updates privacy
documentation and the runner's art-address setting; the client, server,
browser library and case fixtures are identical to the full-run revision.
The already loaded full-run process keeps its original runner. The merged
runner received a separate fresh check below, using the same authorized
art setting privately through `SE_E2E_LIVE_ASSETS`.

All checks use local servers and throwaway accounts. Only ordinary public
art is fetched; no live game account or save is used.

| Check | Result |
| --- | --- |
| Client types | Passed |
| Client tests, before integration | 437/437, 8.904 seconds reported by Node |
| Server tests, before integration | 449 run, 440 passed, nine existing PostgreSQL skips; 55.881 seconds |
| Client types/tests at `5e080221` | Types passed; 437/437, 10.894 seconds reported by Node |
| Server tests at `5e080221` | 449 run, 440 passed, nine existing PostgreSQL skips; 34.549 seconds |
| Focused Chromium, final runtime | 1/1, 187 seconds |
| Full Chromium at `e333f8c9` | 89/89, 2h 3m 48.08s including build |
| Merged runner, missing art setting | Expected exit 2 and setting message, before a browser starts |
| Merged runner at `5e080221`, configured art | 5/5, 6m 37.80s including build |

The first server result preceded the final client-only preview correction;
server source and its tests did not change. Both unit suites were rerun
after the main merge. The preview regression failed
on the original negative timestamp and passes with the correction. Its
cleanup was corrected to stop before restoring the mocked browser globals.

The configured merged-runner check passed `shop-details` (191s), `storage`
(45s), `phone-place` (64s), `classic` (50s) and `team` (39s). These are
rounded scenario times; the table gives the measured total. The separate
missing-setting guard exits before building or starting a browser. Final
delivery edits after `5e080221` change Markdown only.

The focused browser scenario checks:

- Closed details stay closed while hovering/focusing cards and Details.
  Click toggles, Enter/Space activates, Escape closes details before the
  shop, and closing Storage dismisses its details.
- Hovering another desktop card cannot replace explicitly opened details.
  On the touch layout, the open bubble covers the cards; Close details and
  the focused button's keyboard activation dismiss it.
- Every Details button's text and bounds fit its grid cell at 320, 360,
  390, 720, 768, 1000, 1024 and 1280 pixels. The 720-pixel case is landscape;
  tablet portrait and desktop panel layouts are included. Storage is also
  checked on desktop and a touch-enabled 390-pixel phone.
- Locked facts, six training-unit stats and animation pixels, ten combined
  castle/unit stats, tall bubble bounds and original badges remain checked.
- Map items, Storage, cash and early-unlock state stay unchanged after
  viewing details.

## Retained initial failures

No failed result is counted as a pass, and no test or error check was
disabled. The initial failures are retained in the local evidence folders.

| Revision | Focus result | Explanation |
| --- | --- | --- |
| `112e43e1` | 0/1, 179 seconds | The new fixture tried to hover a phone card behind its open bubble. Kept desktop hover coverage and used the phone's actual explicit dismissal paths. |
| `e0219618` | 0/1, 186 seconds | Layout/save assertions completed, but the page reported the preview's `length` exception. |
| `bbcc6660` | 0/1, 59 seconds | The original pixel check correctly timed out on the blank training animation. The harness retained stacks but did not yet print accumulated page errors after an assertion timeout. |
| `15c21a06` | 0/1, 61 seconds | Same pixel timeout; improved diagnostics confirmed the stack at the preview's negative-index operation. |

The harness now retains page-error stacks and includes accumulated errors
alongside an assertion failure. Both failures still fail the scenario.

## Screenshots, logs and limits

All 36 initial-failure captures and all 18 final focused captures were
reviewed in contact sheets; the initial desktop House, 320-pixel layout,
phone overlay failure and blank training failure also received full-size
inspection. Exact SHA-256 manifests and review records live under ignored
`work/click-details/`, with complete browser/server logs for each run.
The focused and complete full-run server logs have no Python tracebacks,
HTTP 5xx or unhandled commands. All 527 full-run captures were reviewed in
eight batches (one split between two reviewers), with selected native-size
inspections. Review records cover the entire hash manifest without overlap,
and every recorded hash matches its archived file. No new actionable menu
regression was found.

The merged-runner archive has 26 fresh captures, reviewed separately from
the full run. Its complete server log also has no Python tracebacks, HTTP
5xx or unhandled commands. An independent final source/documentation review
found no actionable issue. Fresh automated review was unavailable: Cubic
reported its monthly line limit with a neutral check, and Qodo reported its
expired trial. No source review finding or required check was bypassed.

The full review's Black Dragon ground seams and camera crop also occur
in the earlier menus baseline; that whole capture is byte-identical.
The phone goal's decorative-wizard crop is visible in both baseline and
current captures, with its text/buttons inside the screen. Their countdown
text differs, so whole-image identity is not claimed for that pair. Exact
paths/hashes and the comparison limits are in the second review batch.

Contact sheets establish broad layout coverage; they do not establish every
animation frame or fine text at native resolution. Some New-card thumbnail
requests are pending in their captures. Selected/available team portraits
are also blank in one capture, while the picker and landed unit render;
that image does not establish the cause. The classic capture has Ruffle's
hardware warning and unmute overlay. Narrow/short sheets can show
only a small part of the scrollable catalogue; tall phone stats and team
results also continue below their sheet's scroll edge. Large armies can
crop under the HUD or at the camera edge. The weekly battle's landscape-
labelled capture is 2160 by 2808 and does not itself prove complete short-
landscape viewport visibility. No art-loading or general sheet redesign
is claimed. This slice uses Linux Chromium with software
rendering; it does not claim a fresh WebKit/Mac-GPU result.

Existing feature holds and the other chats' combat/click controls,
collection kill triggers and special buildings remain with their owners.
