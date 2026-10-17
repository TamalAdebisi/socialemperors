# Dragon rider and taming verification

Local work on 17 October 2026. No live accounts or live game server were
used. Original source was inspected locally only; no original source is
published. Browser runs are serialized with the other special-building
slices on this shared two-CPU software-rendering machine.

## Code and current status

`61c966fb` implements the native windows, rules, art exports and our own
loader for the unchanged shipped adventure. `09dcb608` selects Ruffle's
bitmap-capable renderer and makes the focused test detect its formatted
runtime error messages. `cd8b6eec` calibrates the new native-play fixture
against observed game progress and a bounded movie clock. Its predecessor
`7ee25cbe` was reverted by `9c4ea523` before that calibration was reviewed;
those two commits have no net effect.

Before the strengthened native journey, client types and all 409 client
tests passed; focused command tests passed 38/38. Shared integration at
`97b12e13`, including `09dcb608` and the doorway-arrival correction for
Dragon Riding, passed types, all 445 client tests and 462 server tests
(453 passed, nine existing skips). These results precede `cd8b6eec` and
the later single-batch rider-claim correction. Complete focused Chromium,
Linux WebKit and combined integration verification remain pending.

The permanent fixture checks original picker art/locks, close without
progress, an ignored stale-session callback, genuine first-adventure win,
all paid recoveries, the page-session shortcut, free rider claim and its
single ordered reward/reset request, ordinary map entry of both units,
genuine eighth-adventure loss preserving the pair, and phone layout/input
and saved transformation. The phone win is a deterministic success-adapter
event. It does not prove a genuine eighth-adventure win or all eight
adventures. No result below should be read as that broader claim.

## Renderer evidence and fixture calibration

The first drawing/adapter smoke was insufficient. With Ruffle's legacy
`webgl` renderer, keyboard and touch events reached the original actor
and the loader's frame counter advanced, but the actor's position and
velocity stayed still. The original collision library uses bitmap drawing
and reading. A diagnostic captured Ruffle's actual AVM2 failure,
`Render backend does not support BitmapData.draw`. This was a real runtime
fault, not a missing key binding or tutorial acknowledgement.

With `preferredRenderer: "wgpu-webgl"`, the same original movie and input
advanced its actual actor and scrolling world: observed distance changed
from 0 to 210.319 by frame 59, then to 732.798 by frame 121; velocity was
1.7. No AVM2 error was emitted. The software graphics driver reported
readback-stall performance warnings. The last 62 observed frames took
roughly 20.85 seconds between diagnostic captures, about three FPS.
The original file, speed, quality and movie clock were not changed.

The initial 60-second whole-journey cap was an unmeasured assumption in a
new test. It failed again after the renderer correction while the actor
was visibly moving. Local original-source review confirmed the displayed
attack instructions do not pause movement or require acknowledgement.
The town loop already stops its rendering ticker during the opaque
adventure. No town-rendering or general-control change was needed.

The reviewed replacement uses a hard 600-original-movie-frame budget per
genuine adventure. Each progression segment must reach its goal or advance
at most 30 frames within 30 seconds; observational polling is 250 ms.
Walking also requires changed actual world position, so the first bad
backend's advancing-wrapper/frozen-actor state fails. Loss waits require
changed actual combat, position or end-screen animation state. Attacks
wait on the original animation's frame progression. Screen, input,
callback, save and currency assertions remain. Established tests and
their limits are unchanged; the new journey's initial wall cap was
explicitly replaced, not described as unchanged.

## Retained attempts

Each attempt's files were copied out before the next run. Paths below are
local ignored evidence under `work/`; they are not published game source.

| Attempt | Result and limit | Evidence directory |
| --- | --- | --- |
| Initial API smoke | Failed in 42 s: used an outdated Ruffle API call. Corrected to the pinned runtime's `ruffle().callExternalInterface`. | `work/rider-browser.log` |
| Drawing/adapter smoke | 1/1 in 36 s, but proved drawing/adapter saving only. Later physics failure invalidates any stronger inference. | `work/rider-smoke-passing/` |
| Strengthened focus 1, `61c966fb` | 0/1 in 88 s; 60-second approach timeout with frozen actor. | `work/rider-focus-attempt-1/` |
| Input diagnostic 1 | 31 s; events reached actor and wrapper advanced while actor remained still. Diagnostic only, not feature verification. | `work/rider-probe-attempt-1/` |
| Input diagnostic 2 | 35 s; captured unsupported bitmap-draw errors. A start deferral did not fix them and was removed. | `work/rider-probe-attempt-2/` |
| Renderer diagnostic 3 | 62 s; real keyboard/touch motion and actual world progression, no AVM2 errors. No end-screen callback assertion. | `work/rider-probe-attempt-3/` |
| Strengthened focus 2, `09dcb608` | 0/1 in 92 s; initial 60-second approach cap expired while actor moved normally. | `work/rider-focus-attempt-2/` |
| Early calibrated retry | Interrupted to release the shared browser slot after 13 s. Runner reported its closed page, shell exited 143. No completed feature result. Calibration was reverted before reviewed replacement. | `work/rider-focus-attempt-3-interrupted/` |

The temporary diagnostics are excluded from the permanent browser test
discovery. Their assertion summaries are not counted as feature passes.
The early picker/adventure/recovery captures and both failed-focus captures
were inspected. The actual genuine-win/loss and phone images must be
reviewed after the pending focused runs. Earlier local server logs contain
no traceback or HTTP 5xx; that does not substitute for checking final logs.

Linux WebKit needs the locally extracted library recipe in
`work/browser-deps/README.md` in the main execution worktree. That setup
skips only Playwright's package-presence validator, not browser errors or
game assertions. Linux software WebKit verification does not establish
behavior on the owner's Mac GPU or installed Safari.
