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
the later single-batch rider-claim correction. The later clean shared
integration at `f3529ef2`, including the rider claim/lifecycle corrections,
passed types, all 447 client tests and 467 server tests (458 passed, nine
existing skips). Its recorded command times were 16.202 and 35.337 seconds.

The complete permanent Chromium focus passed **1/1 in 540 seconds** at
clean `54a1ad0a9213593e7e7f4f945798e8f828e345fc`, runner exit 0.
That pass precedes the later WebKit touch-focus correction. Linux WebKit
and combined full-browser integration verification remain with the
coordinating slice before merge.

The permanent fixture checks original picker art/locks, close without
progress, an ignored stale-session callback, genuine first-adventure win,
all paid recoveries, the page-session shortcut, free rider claim and its
single ordered reward/reset request, ordinary map entry of both units,
genuine eighth-adventure loss preserving the pair, and phone layout/input
and saved transformation. The phone win is a deterministic success-adapter
event. It does not prove a genuine eighth-adventure win or all eight
adventures. No result below should be read as that broader claim.

## Complete focused Chromium result

Command: `PYTHON=.venv/bin/python node e2e/run.mjs rider-training --keep`.
The retained ninth attempt is `work/rider-focus-attempt-9/`, containing
the full output, server log, exact revision/result receipt and all 15
fresh screenshots. The throwaway save is `/tmp/se-e2e-DtuHwG`.

The genuine original first-adventure button produced `won,1` and the
eighth-adventure button produced `lost,8`. Both gameplay outcomes and the
ready loss menu met the unchanged 600-movie-frame budget. First-stage
ordinary inputs used the available third skill and basic attacks; the
loss used ordinary movement and no attacks. The loss reached zero health
at movie frame 541 and the original animation then completed normally.
The callback arguments were observed and forwarded unchanged, rather
than substituted by the fixture.

The same run verified the close/stale-session guards, every cash recovery
and session shortcut, the final free rider and reset in one ordered real
command request, exactly 75 cash spent, reopening without a second claim,
and exact rider-first admission before the compatible dragon. Genuine
loss preserved both saved inputs. The phone then rendered the original
eighth adventure and accepted a real touchscreen basic attack, observed
through its original cooldown and visible attack pose. Touch controls
did not take keyboard focus. Its separate success adapter saved the configured mounted
output, consumed both inputs and spent no further cash.

All 15 fresh captures were inspected: picker, original first adventure
and victory, recovery and ready claim, taming pair, original eighth
adventure and loss, phone pair/adventure/picker, and the four actual CPU
renderer notices. Original images and text render, desktop cards fit,
and the phone's pair and three choices fit across its scrollable sheet.
The phone attack pose and both native result screens are visible. The
server log has no traceback, exception or HTTP 5xx, and the focused output
contains no runtime-error capture. No failed attempt below was removed.

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
| Strengthened focus 4, `d590401d` | 0/1 in 212 s. Actual normal-input first victory within 600 frames; zero-delay mouse click did not dispatch the original End Game handler, so the required recovery never appeared within 30 s. | `work/rider-focus-attempt-4/` |
| Strengthened focus 5, `df2effdc` | 0/1 in 220 s. Again won normally within 600 frames; separate real mouse phases still did not dispatch the original callback. | `work/rider-focus-attempt-5/` |
| Strengthened focus 6, `fa300650` | 0/1 in 261 s. Genuine original win callback `won,1`, recovery saves, every paid recovery/shortcut and ordered free-claim/reset passed. Later map-selection probing accidentally admitted the wide dragon first; selecting it again then failed. | `work/rider-focus-attempt-6/` |
| Permanent focus 7, `dca56ac4` | 0/1 in 494 s. Both gameplay outcomes, including the ready loss menu, met the 600-frame budget. A redundant post-screenshot mouse-phase check then counted idle finished-screen frames against that gameplay budget. | `work/rider-focus-attempt-7/` |
| Permanent focus 8, `ecf4b6d2` | 0/1 in 236 s. Normal basic attacks defeated the opponent, but blocked/missed swings exhausted the 600-frame budget before reaching the last screen edge. No runtime error; the budget was retained. | `work/rider-focus-attempt-8/` |
| Permanent focus 9, `54a1ad0a` | 1/1 in 540 s, runner exit 0. Genuine original first win and eighth loss callbacks, paid recovery/ordered claim, ordinary pair admission, phone input and saved transformation all passed. All 15 fresh captures and final logs were reviewed. | `work/rider-focus-attempt-9/` |
| First combined Linux WebKit rider case, `22f5fd02` | 0/1 in 422 s. Genuine first win and eighth loss callbacks, claim and pair admission passed. The real phone attack reset its original cooldown, then the existing assertion found one touch-control button retaining DOM focus. This observes button focus, not a window blur or failed attack. The run stopped before phone transformation and its adventure capture. | Coordinator's `work/checks/integrated-webkit-six-initial/` and `work/e2e-webkit/rider-training/` |
| Mouse diagnostic 1 | 28 s. Native browser down/up/click arrived, but no original stage event. Diagnostic only. | `work/rider-mouse-probe-attempt-1/` |
| Mouse diagnostic 2 | 40 s. First click intercepted; second native click reached the original attack button. Focus alone was only a hypothesis. | `work/rider-mouse-probe-attempt-2/` |
| Mouse diagnostic 3 | Failed in 31 s. Fresh-instance explicit focus did not fix the first click. Its exact composed path identified Ruffle's hardware-acceleration modal. | `work/rider-mouse-probe-attempt-3/` |
| Mouse diagnostic 4 | 40 s. Asserted/captured actual standard renderer advice, clicked its X, verified dismissal and then observed genuine original stage down/up/click. | `work/rider-mouse-probe-attempt-4/` |
| Entry diagnostic 1 | Failed in 18 s: the temporary probe misread the existing helper's map-only return shape. | `work/rider-entry-probe-attempt-1/` |
| Entry diagnostic 2 | Failed in 18 s: moving the wide dragon alone did not prevent the searching building clicks admitting it first. | `work/rider-entry-probe-attempt-2/` |
| Entry diagnostic 3 | Failed in 44 s: the first globally visible top-wing pixel changed with animation and the later click sent the rider to ground. | `work/rider-entry-probe-attempt-3/` |
| Tail diagnostic 4 | Failed in 31 s after correct rider-first admission: the extracted temporary scope lacked its local saved-state variable. The permanent fixture already declares it. | `work/rider-entry-probe-attempt-4/` |
| Tail diagnostic 5 | Failed in 40 s after both correct admissions: the extracted temporary scope also lacked its window locator. The permanent fixture already declares it. | `work/rider-entry-probe-attempt-5/` |
| Tail diagnostic 6 | Failed in 282 s at the unchanged 600-frame adventure budget. Genuine boss damage reduced health to 135, but very close actors caused many displayed attack regions to miss. No freeze or runtime error. | `work/rider-entry-probe-attempt-6/` |
| Tail diagnostic 7 | Failed in 289 s at the same budget. Earlier ordinary movement release improved spacing and health fell to 83; read-only geometry proved remaining magic attacks missed the right-facing actor. | `work/rider-entry-probe-attempt-7/` |
| Tail diagnostic 8 | Passed in 306 s: exact rider-first/pair admissions, genuine eighth-adventure loss and original `lost,8` callback preserving both units, real phone attack input, phone success-adapter transformation/save and picker fit. Rider was seeded for this diagnostic; it does not prove the training section as one complete run. | `work/rider-entry-probe-attempt-8/` |

All nine fresh captures from the first WebKit rider case were inspected:
picker, first adventure and victory, recovery and ready claim, taming pair,
eighth adventure and loss, and phone pair. Original art, text and both
actual result screens render; desktop cards and the phone pair fit. The
failure occurs before the phone adventure, final transformation or phone
picker capture, so those visual checks are not claimed for that attempt.
The runner's failure capture uses the already closed desktop page; the
unchanged DOM-focus assertion and output retain the failure without a
separate phone failure image. This is a failed rider case despite its
successful native callbacks and phone attack.

The failed native-win images still show the original victory screen and
the correct button highlighted. Local source inspection establishes that
its click handler always leaves that screen, including when its parent
callback fails. Instrumentation in our own loader and real browser event
paths then established the exact reason: the pinned Ruffle runtime opens
its standard hardware-acceleration advice on the first mouseover of each
CPU-rendered player. The intended game click instead dismisses that
modal; by the failure screenshot, the advice is already gone. The modal
was visible and fully opaque, with its normal text and X. There was no
invisible-modal product bug and no need to change focus or the loader's
parent hierarchy.

The fixture now asserts the actual advice and acknowledges its ordinary
X once per new player before gameplay, including the phone instance.
The product warning and all renderer settings remain unchanged. The
fixture retains native mouse phases over observed movie updates and
records genuine callback arguments before forwarding them unchanged.
The existing 30-second recovery/save requirements remain. Temporary
mouse instrumentation was removed and the original authored loader
artifact restored before the next focused run.

Focus 6's saved order was dragon then rider. The existing map helper
searches by clicking successively higher pixels; with this large dragon
nearby, its first clicks selected the dragon and its next click correctly
ordered that selected unit into the building. The fixture now checks one
stable building-body pixel with the existing read-only hit test, makes
one ordinary mouse click, and verifies the displayed card. It asserts an
initially empty building and an exact rider-only first admission before
the dragon's ordinary entry. No shared click/cursor behavior was changed.
The native attack loop also faces the actual enemy before every ordinary
attack, including an enemy that crossed behind at close range; its game
clock and liveness caps are unchanged.

The separate taming-loss diagnostic also exposed a deliberately losing
input strategy that was inefficient, rather than a game-speed problem.
Releasing movement too close let the actors coast through each other;
the original displayed attack regions missed. Earlier release left the
boss 44.5 pixels away: its basic attack rectangle overlapped the hero,
but several magic rectangles ended just left of the right-facing hero's
body. The 600-frame budget correctly failed both probes. Position,
health, original animation frames and hit-region rectangles were recorded
read-only by temporary instrumentation in our own loader. Releasing at
220 pixels and making one ordinary left turn aligned the original body
with the attacks: observed left-facing body bounds were about 274.85 to
353.95 at hero origin 300, with the boss 58.65 pixels to its right.
Health reached zero at movie frame 547; the original loss animation and
end-screen button produced `lost,8` within the same 600-frame journey
budget. Phone touch then reset the original attack cooldown without
stealing focus, and the separate success adapter saved the transformation.
The diagnostic was archived and all temporary geometry instrumentation
removed before the complete permanent case is rerun. No original game
state, drawing quality, speed or verification cap changed.

Permanent focus 7 reached genuine loss at frame 598 and the ready original
menu around frame 641, from a journey start around frame 44: the required
gameplay result and ready menu passed the 600-frame check. The screenshot
then allowed the idle finished movie to reach frame 673 before its first
mouse phase, where a redundant budget check failed. The mouse phases now
sample the original frame without reapplying the completed gameplay cap.
`gameUntil` still enforces 600 frames through victory or the ready loss
menu, and native mouse phases, callback and save retain 30-second liveness.
This does not extend the gameplay budget or change its completion goal.

The unchanged 28-frame basic-attack wait was checked against the original
ready condition: the attack starts its general cooldown at 10; combat
locks input only below 25, and the separate attack cooldown is one update.
There is no source requirement to wait 30 updates for that attack.
The first-adventure input strategy now also uses its available original
third skill, respecting its 150-update cooldown, alongside basic attacks.
The stronger original skill and its knockback reduce reliance on repeated
blocked melee swings. This changes only ordinary input choices; the
600-frame result budget, 28-frame attack observation, original game,
health, enemies and all save/callback assertions remain unchanged.

The temporary diagnostics are excluded from the permanent browser test
discovery. Their assertion summaries are not counted as feature passes.
The early and failed captures remain historical evidence. The complete
ninth attempt's genuine-win/loss and phone images and its final server
and runtime logs were separately reviewed, as recorded above.

## WebKit touch-focus correction

After the coordinator's six-case run exited, an isolated local DOM probe
used the same phone viewport, mobile/touch settings and exact authored
pointer listeners in WebKit and Chromium. Its eight variants and complete
trusted-event sequences are retained in `work/rider-touch-focus-probe.mjs`
and `.log`. This is browser-behavior diagnosis, not a complete game pass.

WebKit reproduced the focus failure: after a cancelled `pointerdown`, it
still sent a compatibility `mousedown`, then moved focus from the stage
to the button. Chromium suppressed that mouse-down and kept the stage
focused. Adding a `mousedown` default cancellation to these buttons alone
kept the prior stage focused in both engines. Actual pointer down, up and
capture-release callbacks still occurred. Ordinary keyboard Tab reached
the button and Enter produced its native click in every variant; those
defaults remain available. Diagnostic assertions checked the reproduced
failure and both corrected outcomes.

The product correction adds only that scoped listener beside the existing
pointer handler. The adventure's window-captured gameplay keys already
worked regardless of the focused element, so retained button focus did
not itself establish a lost input or stuck key. The existing phone-focus
assertion, native callbacks, save checks, 600-frame adventure budget and
30-second liveness limits are retained. Client types pass after this
listener change. A complete rider WebKit rerun and the final combined
Chromium suite remain required on the corrected code.

Linux WebKit needs the locally extracted library recipe in
`work/browser-deps/README.md` in the main execution worktree. That setup
skips only Playwright's package-presence validator, not browser errors or
game assertions. Linux software WebKit verification does not establish
behavior on the owner's Mac GPU or installed Safari.
