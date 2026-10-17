# Structure idle verification — PR #96

## Scope and code

The reported Lumber Mill I alternated its finished picture and scaffolding.
Its hover halo could retain the scaffold silhouette. The old-build browser
regression reproduced both, including a screenshot matching the owner's
report. The shared repair separates idle/action states, keeps nested motion,
synchronizes the hover silhouette immediately before drawing, and omits
seven measured fully blank loop-ending pictures.

Initial broad-run runtime: `792a3bf8` (based on `1eb2a2e2`, including PR #94).
Outline follow-up: `13097484`; pre-integration input/runtime code: `c1a58b6f`.
Full-suite integrated runtime: `cab2d7dd`, merging main `a3328da6` (PR #95). Visual review caught a walking-unit
outline displaced by the new synchronization: walking moved the outline's
wrapper, then frame synchronization copied the already moved source
position. Resetting the wrapper before synchronizing prevents applying the
movement twice. A real walking-renderer regression checks matching textures
and positions on twelve frames, then reloads and checks the unchanged save.
The old-build browser regression reproduces that displacement in 17 seconds.
A separate browser check reproduces a lost near-miss selection after a
650 ms input-processing stall in 13 seconds.

The WebKit input trace also measured a 122 ms native click whose release
handler ran 1.856 seconds after the press handler. The old camera rejected
it as a long hold. Pointer and double-click timing now use event timestamps.
Two unit tests distinguish a delayed short click from a genuine long hold;
the browser test retains real native pointer events during its forced stall.
Main #97 (`8f8c57ab`) was integrated at `cba773de`. Runtime
`48232c57` adds Safari-specific texture decoding; runtime `bbfffdc5`
limits the fixed-pose export to its two used image pages. Runtime
`0185b420` uses ordinary image elements in Safari after a second rendering
regression was reproduced with page-created ImageBitmaps. Runtime
`d04c924e` tested disabling automatic mipmap generation; the wider run still
reproduced the fault, so that setting is withdrawn. A WebGL 1 comparison
also failed and is not retained. Other engines retain their existing
loading and mipmap paths. Recovery runtime `947c30a2` restores normal workers
and recovers only blank bitmaps; its exact ground-pixel guard verifies that
the previously blank atlas does not damage the existing scene.
Runtime `862d9893`, after main #92, also recovers one atlas that reproduced
partial worker corruption and checks its original alpha grid exactly.
PR: https://github.com/TamalAdebisi/socialemperors/pull/96.
Main #95 keeps Shift as the third tap argument and input time as the fourth;
the delayed-click unit regression asserts both values independently.

The inventory covers all 1,010 configured building entries (969 art names).
900 readable source/public-sheet files cover 941 entries. All 2,163 atlas
pages were checked for unresolved animation references and empty frames.
The browser regression exercises 98 files in 199 facings: all 86 stateful
files, seven blank-ending repairs, four true-motion controls and one static
tower. It also checks occupied stables, upgraded sheep ranch counts,
idle/attack/idle tower transitions, live animation/outline synchronization,
walking outlines, selection and unchanged server saves.
[The audit](structure-idle-audit.md) lists the 69 unavailable legacy art names
and explains the one incomplete animation kept on a steady original pose.

## Environment

All gameplay tests used local servers, separate throwaway players and local
art caches backed by read-only public-art requests. No live accounts or
live gameplay, database operations or art uploads were used. One browser
runner ran at a time.

Python 3.13.5, Node 24.19.0, Playwright 1.56.1, Linux 6.18.44;
two CPU cores, 8 GiB memory, software rendering. The initial full suite used WebKit 26.0,
matching Safari's engine. The integrated full suite uses Chromium, followed
by focused WebKit checks of the changed and previously failing paths.
This is not a test of the owner's Mac GPU or installed Safari build.
WebKit's local shared libraries are supplied through `LD_LIBRARY_PATH`.
Host package validation is disabled because it cannot see those extracted
libraries; browser assertions, error collection and tests stay enabled.

## Verification results

Client durations below are reported by the test runner; build durations
are Vite's reported bundling time. Type checking also passed and is not
included in those reported durations. Browser totals include their runner
setup and teardown.

| Run | Result | Elapsed |
| --- | --- | --- |
| Combined main #92 server at `46f61c94` | 449 run: 440 passed, 9 existing skips | 40.942s |
| Combined main #92 client | Types passed; 404/404 tests passed | 15.212s |
| Combined main #92 build | Passed | 1.03s |
| Partial-corruption repair at `862d9893` | Types and 404/404 client tests passed; build passed | Build 0.790s |
| Complete combined Chromium, all 79 cases | 77/79; collect and siege follow-ups below | 8551.78s |
| Combined WebKit, six affected cases | 5/6; tournament page errors and one gallery visual mismatch below | 545.66s |
| Final repair WebKit at `862d9893`, seven cases | 6/7; full 199-facing gallery and collection passed; tournament polling warnings retained | 671.57s |
| Final repair Chromium at `862d9893`, one-atlas focus / collect / siege | 3/3 | 255.75s |
| Pre-#92 server, including main #97 | 442 run: 433 passed, 9 existing skips | 47.173s |
| Client after main #97 | Types passed; 368/368 tests passed | 20.035s |
| Build after main #97 | Passed | 1.01s |
| Client after Safari decoding repair | Types passed; 368/368 tests passed | 10.275s |
| Client after fixed-pose loading repair | Types passed; 368/368 tests passed | 9.670s |
| Build after fixed-pose loading repair | Passed | 0.737s |
| Client after Safari image-element repair | Types passed; 368/368 tests passed | 12.041s |
| Build after Safari image-element repair | Passed | 0.753s |
| Mipmap comparison client at `d04c924e` | Types passed; 368/368 tests passed | 17.429s |
| Mipmap comparison build | Passed | 1.70s |
| Final client at `947c30a2` | Types passed; 368/368 tests passed | 17.002s |
| Final production build | Passed | 1.31s |
| Final WebKit at `947c30a2`, including exact ground guard | 8/8; gallery 98 files / 199 facings | 388.40s |
| Final Chromium new guard, one-atlas focus with mill/walking/tower/save checks | 1/1 | 95.88s |
| Complete integrated Chromium on `cab2d7dd` | 72/74 | 2h 21m 22.24s |
| Chromium after main #97, affected paths and failure follow-ups | 11/12 | 26m 31.46s |
| Chromium completed-town fixture correction, `8a6a7397` | 2/2 | 4m 36.34s |
| WebKit after main #97 | 12/20 | 18m 16.44s |
| WebKit phone, recovery and two-file capture diagnostics | 2/3 | 2m 14.58s |
| WebKit two-file extraction-root diagnostic | 1/1 | 60s check |
| Previous-main WebKit original construction test | 0/1, same timing assertion | 41.09s |
| WebKit first rendering-fixture follow-up | 1/4 | 220.38s |
| Chromium final worker queue/banner follow-up | 1/1 | 150.25s |
| WebKit final worker queue/banner follow-up | 1/1 | 59.88s |
| WebKit first Safari-decoding follow-up | 6/9 | 521.67s |
| WebKit after bounded fixed-pose loading, `bbfffdc5` | 6/7 | 359.02s |
| Chromium on `bbfffdc5` | 4/4 | 1199.83s |

Before #92, all 75 then-current Chromium cases had passing results across the complete,
affected-path and follow-up runs. This is not a single 75/75 run on the
last commit. Main #97 changes optional contact links and menu/header layout,
not drawing, game rules or saves. Its ten affected Chromium checks passed
on `cba773de`. The complete suite is attributed to its actual runtime.
The final blank-bitmap recovery changes Safari only; affected engine checks
are attributed separately below.
Final browser follow-ups and their limits are recorded below.

The Java visual-metadata generator also passed source/target-11 compilation
and byte-identical regeneration of all 900 readable files and 86 state
selectors. A sorted set replaces Java 16's stream terminal operation. This
machine lacks release-11 API stubs, so the first `--release 11` attempt was
unavailable; the successful source/target check emitted its standard
modules-path warning. All 28 two-frame social-building facings are covered
by the new general metadata; the removed old special case has no omissions.

## Failures, diagnoses and test corrections

The complete Chromium run failed `scripted` at a 30-second combat wait and
`scripted-stories` loading its fourth town within 60 seconds. The latter
passed unchanged in the focused run. A diagnostic repeat of `scripted`
passed the earlier waits, then failed its final wave at battle frame 142:
zero active fighters or pending network requests, but the game requires
150 quiet frames to finish. Abandoned towns in these multi-scenario tests
still competed for the same software renderer. Both tests now flush saves
where needed and close each completed town before opening the next. Both
then passed, with identical assertions, game speeds and completion deadlines.

The latest 20-case WebKit run retained eight failures:

- `structure-idle` passed 13 files/26 facings, then found empty pixels for
  `1479_chained_levelup` facing zero. Earlier failure screenshots showed
  facing one and were not evidence that facing zero rendered correctly.
  A dedicated normal-canvas capture confirmed that facing zero could vanish.
  Extra frames, detaching the extraction root, normalized coordinates,
  releasing the prior WebGL context and `gl.finish()` did not fix it. A
  two-file probe and one screenshot-assisted probe happened to pass; neither
  proved a repair. The final test keeps its original extraction and strict
  visibility checks; the temporary capture changes were withdrawn.

  The source file has 42,784 nontransparent pixels in that frame. In a
  reproduced failure, the worker-created ImageBitmap had **zero** visible
  pixels even when cropped in a CPU canvas. A fresh Sprite, texture update
  and texture unload/re-upload all remained empty, with no GL error.
  Creating an ImageBitmap from the same URL on the page produced **42,784**
  visible pixels on both CPU and GPU. The original worker bitmap stayed
  empty after that decode; this was not merely an unpainted screenshot or
  an invalid source file. An HTML image control produced the same 42,784.
  Facing one remained valid throughout, with 42,782 source pixels.

  Runtime `48232c57` uses Pixi's supported `preferWorkers: false` preference
  when its existing Safari detection matches. Decoding remains asynchronous,
  with the same original files and mipmaps. Other engines retain workers.
  No pixel assertion, source-frame choice or failing building was removed.
  The original full gallery is rerun on this repair below.
- `playthrough-controls` sampled no phone selection immediately after its
  tap. A tracing repeat passed with native pointer events 99 ms apart and
  the intended villager selected. This did not establish a new runtime
  cause. The test now lets the camera render before measuring the target,
  uses the actual picture bounds as on desktop, confirms it hits canvas,
  and waits for the expected selection. It retains the native touch five
  pixels outside the art and the same selected-villager assertion.
- `construction` spent its ten-second building period on software drawing
  before finishing the early input checks. Its original test is retained.
  A separate controlled-clock experiment checked the exact 9,999/10,000 ms
  boundary but introduced fixture failures: Store actionability (69s), an
  unflushed three-second save batch (46s), then later worker entry (83s;
  126.17s including teardown). Playwright's clock also replaces animation
  timing and the native event timestamp getter, so this experiment was
  withdrawn rather than changing the test around those effects. The failed
  runs remain local evidence and are excluded from final pass counts. The
  earlier 46-second experiment's other cases, unchanged by the clock, passed:
  `villagers` in 89s and `playthrough-controls` in 76s. A previous-main/current
  original-test comparison is recorded with the final WebKit follow-up.
  Previous main `1eb2a2e2` fails the identical wall-clock assertion in 34s
  (41.09s including setup/teardown), confirming this predates the repair.
- `villagers` sampled zero yellow pixels before the selection outline had
  drawn; the later failure screenshot had 215 pixels matching the unchanged
  color threshold. It now waits two render frames before each screenshot.
  That assertion passed on the next WebKit attempt, which then failed
  reading a transient banner between separate count/text calls (77s).
  Check the full queue before screenshots can finish its first job, and
  read the same banner atomically within the original ten-second limit.
  The complete case then passed in both engines, including saved-tree
  checks and the unchanged pixel threshold.
- `lessons-recovery` completed its gameplay assertions but failed the error
  gate on three image-fetch access-control errors. Its tracing repeat
  passed without those warnings. That repeat does not establish their
  exact cause; the original failure remains recorded.
- `neighbours` and `tidy` completed their gameplay assertions but failed on
  navigation-cancelled image-fetch warnings. Both reproduce on previous main
  `1eb2a2e2`: the trace records `Load request cancelled`, immediately followed
  by the warnings and main-frame navigation. Error monitoring stays enabled.
- `classic` stopped at Ruffle's error page before loading the town. Previous
  main also fails at Ruffle initialization, with a captured WebAssembly
  capacity-overflow panic. The latest run did not capture the same exact
  exception, so this is evidence of the same unchanged failure stage,
  not proof that both exceptions are identical. Chromium classic passed.

Earlier WebKit phone-pointer checks also sampled before the first popup
image loaded. They now wait for its loaded art and two render frames,
retaining the red-pixel and villager-entry assertions. Group double clicks
are sent together: protocol round trips under load had stretched separate
calls beyond the original double-click interval. Group behavior assertions
remain intact. No tests are skipped or errors suppressed to obtain passes.

## Fixed-pose loading and final image readiness

The first nine-check run after Safari decoding passed team, looks, work,
controls, villagers and battle selection. It retained three failures:

- The gallery passed the formerly empty atlas, then exhausted memory loading
  the incomplete fixed-pose export. Its 100 pages occupy **4.255 GiB** as
  decoded RGBA. The WebKit page closed at 153s; cgroup counters recorded two
  OOM events and one killed process. This failure is retained, not called
  a successful gallery run. The source indexes now select only the two image
  pages used by the original first pose in each facing. Original bounds and
  pixels remain, and a browser assertion checks actual requests against both
  displayed pages. Normal animations retain their full loading path.
- Construction's ten-second period had already ended at its initial
  scaffolding assertion (26s total check time). This differs from the earlier
  old-main comparison's later wall-clock assertion and is retained separately.
  The original construction test is unchanged and is rerun after the memory
  repair; no clock experiment is retained.
- Building-overlay sampled a uniform `[102, 156, 44]` loading background
  before selection, then correctly textured grass afterward. It now requires
  a textured ground baseline within ten seconds. All following before/after
  ground pixels still have to match exactly; no tint assertion is loosened.

The other abandoned diagnostics remain under ignored `work/idle/`: root
extraction, coordinate normalization, context release and graphics finish
all failed to repair the empty bitmap. Their logs retain the measurements.
Two diagnostic wrappers failed while serializing circular data or racing a
navigation; a screenshot callback accidentally returned its large buffer
across the page bridge and was stopped. An environment refresh interrupted
another diagnostic. These wrapper/interruption results are not gameplay
passes or engine regressions. The decoder comparison above supplies the
actual root-cause evidence.

The first decoder-only run's eight non-gallery final images were reviewed,
including the construction and overlay failure screens. Its server log has
no HTTP 5xx, Python tracebacks or unhandled commands.

## Bounded-loading runtime browser checks

WebKit on `bbfffdc5` passed **6/7 in 359.02s**. The full gallery passed:
98 files, all 199 facings, every-frame outlines, live nested motion, walking,
occupied animals, idle/attack/idle towers and saved positions. Both first
poses of the incomplete export rendered, and the actual requests contained
only their two image pages. There were **no increases** in memory-limit,
OOM or killed-process counters during this seven-case run.

| Check | WebKit seconds | Result |
| --- | ---: | --- |
| structure-idle | 161 | Passed |
| team | 37 | Passed |
| construction | 21 | Failed |
| looks | 35 | Assertions passed; capture anomaly below |
| work | 53 | Passed |
| building-overlay | 25 | Passed |
| battle-selection | 24 | Passed |

The unchanged construction test passed its initial scaffolding/card checks
but found the building period over when asserting that the farm was still
being built. Its worker count was zero, as expected. This is another timing
assertion in the same ten-second input sequence; it is not the identical
line as the previous-main wall-clock failure. Retain it as a failure. No
construction/runtime clock change is included in this repair. Chromium's
original construction check passed in the complete run; its final result
is recorded separately below.

All 199 WebKit facing captures from this run were inspected in five contact sheets,
as were the normal selected mill/tower, walking outline and six non-gallery
final images, including the construction failure. The mill has a finished
picture and tight silhouette; both previously blank statue facings are
visible. The server log has no HTTP 5xx, Python tracebacks or unhandled
commands. The earlier failures remain in this record.
The passing `looks` case's last normal screenshot contains the town in a
small rectangle over the flat background. Its earlier empty/working shots
are normal. This visual anomaly is retained separately from its passing
gameplay assertions and is investigated below.
The latest-menu WebKit and first decoder follow-up's corresponding farm
images are normal; the final image is not claimed to be visually clean.

The Chromium gallery on this runtime passed in **819s**, with all 98 files and 199
facings, including the two-image fixed-pose request assertion and all
outline/motion/save checks. Its five contact sheets were inspected. All
199 captures also match the complete integrated Chromium captures exactly
in RGBA dimensions and bytes. This comparison checks every color channel,
not only transparency.

Chromium completed **4/4 in 1199.83s (19m 59.83s)** on the same
`bbfffdc5` production bundle. The later image-element change affects Safari
only and is checked separately below. The original construction check passed, as did the unchanged
pixel comparisons and native click/stall/phone-selection checks.

| Check | Chromium seconds | Result |
| --- | ---: | --- |
| structure-idle | 819 | Passed |
| construction | 113 | Passed |
| building-overlay | 193 | Passed |
| playthrough-controls | 67 | Passed |

Both bounded-loading engine runs have unchanged memory counters: reclaim 25,862,
OOM 2, killed processes 1, before and after each run. These are historical
cumulative values; these runs add zero events. Chromium's final three
non-gallery captures and selected mill/tower/walking images were reviewed.
Its server log has no HTTP 5xx, Python tracebacks or unhandled commands.

## Whole-scene regression and ordinary Safari images

Review of the bounded-loading WebKit screenshots caught the farm test's
last image: the town occupied a small rectangle over the flat background.
The old assertions passed because they only checked farm motion. A dedicated
capture run passed those same old assertions in 35s (36.44s total), while
three later screenshots and a direct renderer capture retained the fault.
This was a real rendering regression, not a screenshot-only observation.

The canvas, drawing buffer, viewport and projection uniforms reported their
correct 1280×800 values; scissoring was off and GL reported no error. An
explicit viewport reset did not repair the image (35s diagnostic). Renderer
state reset and rebuilding drawing instructions also failed (41s). Disabling
the new outline synchronization still failed (31s; 32.35s total).

The farm test now also requires varied ground pixels in a fixed visible
patch after a worker leaves. It fails on `bbfffdc5` in 40s (42.40s total),
and passes unchanged on previous main `1eb2a2e2` in 33s (34.10s total).
This regression is not accepted as an unrelated baseline failure.

Several attempted loader comparisons were invalid: their request handler
was installed after the first page load, and the cached module remained in
use. Later explicit hit counts were zero and the actual resource type stayed
ImageBitmap. Those runs cannot establish how ordinary images or restored
workers behave. They include the first apparent HTML comparison (35s;
37.60s total), the zero-hit workers attempt (32s; 33.24s total), and the
subsequent broad-route attempts, retained under ignored `work/idle/`.

A freshly built comparison changed only Safari's loader preference to
`preferCreateImageBitmap: false`, retaining `preferWorkers: false`. It
verified **HTMLImageElement** as the farm's real texture source and passed
the original farm assertions plus the new full-scene check in **33s**.
The final screenshot was inspected and shows the correctly sized town.
The change is committed at `0185b420`. The gallery also asserts the actual
image type for every WebKit facing, alongside its existing visibility,
outline, motion, request-count and saved-position checks. No viewport or
renderer reset workaround is included; other engines keep their existing
ImageBitmap/worker path. Final original-runner checks are recorded below.

## Ordinary-image runtime follow-up: remaining terrain failure

On runtime `0185b420`, the original runner's WebKit check was **6/8 in
369.39s**: `looks` 33s, `structure-idle` 147s, `team` 37s, `work` 48s,
`playthrough-controls` 28s and `battle-selection` 33s passed. The gallery
passed all 98 files / 199 facings with real HTMLImageElement sources.
`construction` failed in 24s at the unchanged “all that while it was being
built” assertion, also seen on previous main. `building-overlay` failed
in 13s before selection, because its ground patch never became textured.
Its failure image shows enlarged building fragments behind the normal town,
not merely a late loading frame. This rendering fault blocked that candidate; the final worker-path recovery below replaces it.

Chromium's unchanged `looks` check passed **1/1 in 223s** (230.37s total).
Both engines' final non-gallery captures were reviewed: the farm's town
fills the scene correctly, while the WebKit overlay capture is corrupt.
All 199 WebKit gallery captures and the mill/tower/walking checks were
reviewed. Both server logs have zero HTTP 5xx, tracebacks or unhandled
commands. Neither run added a memory-limit or OOM event.

An isolated overlay comparison decoded captured PNGs outside the game page,
using the existing Pillow dependency. It passed every unchanged comparison
and preview assertion in **40s** (42.79s total); its final preview screenshot
has correct grass and alignment. The shared screenshot helper adopted that
measurement isolation at `b92edeee`, without changing game code. The normal
WebKit follow-up was **2/3 in 90.75s**: `looks` 42s and `selected` 28s
passed; `building-overlay` still failed in 17s with the same visibly corrupt
terrain. Therefore external PNG decoding is **not a demonstrated rendering
fix**. Its server log is clean and its memory counters are unchanged.
The companion Chromium run passed **3/3 in 479.27s**: overlay 135s,
farm looks 207s and selection 129s. Both engines' final captures were
reviewed; the WebKit overlay failure remains the only corrupted image in
these follow-ups. Chromium also has a clean server log and unchanged
memory counters. The subsequent diagnosis and final recovery follow below.

## Terrain texture diagnostics

The unchanged `0185b420` runtime failed the overlay diagnostic in **25s**
(29.09s total). A full screenshot taken before the first clipped pixel
capture was already corrupt, ruling out that capture as the trigger. All
17 cached texture bindings matched the actual WebGL bindings. The original
grass image and GPU level-zero texture extracted correctly. Clearing Pixi's
texture binding cache did not repair the screen; unloading and re-uploading
the ground texture did. Those diagnostic mutations are not in game code.

A second capture failed in **31s** (34.73s total). The first three mipmap
levels were read directly through a temporary framebuffer: all were
complete, produced no GL error, and visibly contained the correct grass.
The original image, GPU level zero, mip levels, initial corrupt town and
post-reupload town were reviewed. The fault is not a damaged public image
or missing grass pixels. A fresh-build Safari-only comparison disabling
automatic mipmap generation passed **2/2 in 104.90s**: overlay 48s and
farm looks 55s. This was committed as a candidate at `d04c924e`, but the
wider run below disproved it as a reliable repair; it is withdrawn. Both passing final captures were reviewed and
show a complete town with textured grass. Both diagnostic server logs and
the comparison log are clean; the comparison added no memory-limit or OOM
event. Final coverage checks are recorded below.

## Rejected mipmap and WebGL compatibility settings

The wider `d04c924e` run was **7/8 in 350.77s**. Gallery 171s, farm looks
32s, selection 25s, team 26s, phone controls 24s, battle selection 25s and
keys/zoom 31s passed. All 199 gallery captures were reviewed. The unchanged
overlay check failed in 14s before selection; its screenshot has the same
enlarged building fragments and missing grass. Disabling mipmaps does not
reliably fix the fault and is reverted. The queued extra cold launch was
cancelled before it started once this failure disproved the candidate.

A freshly built WebGL 1 comparison restored mipmaps and changed only the
home application's Safari WebGL preference. The diagnostic asserted actual
WebGL version 1. It failed **0/2 in 23.55s**: overlay failed in 13s at the
same ground readiness assertion; farm looks failed in 7s at its unchanged
empty-field pixel assertion. This setting is also withdrawn. No required
assertion was removed, disabled or weakened.

## Return to worker decoding, with narrow blank-atlas recovery

An at-draw diagnostic on the restored ordinary-image runtime failed in
**22s** (24.04s total). All 17 actual texture bindings matched the cache,
all sampler uniforms pointed at their expected units, the default
framebuffer was bound, and GL reported no error. Updating the existing
ground source did not repair the scene; creating a new GPU source after
unloading did. Its images and clean server log were reviewed.

A fresh build using explicit premultiplied RGBA pixel buffers for the grass
also failed the unchanged overlay check in **13s**; farm looks passed in
31s (**1/2 in 45.97s**). That diagnostic conversion is removed. A controlled
previous-main `1eb2a2e2` run then passed the unchanged strict overlay check
in **30s** (31.08s total).

Keeping the new idle/outline/input changes but removing the global Safari
loading preference passed **2/2 in 70.38s**: overlay 31s and farm looks 38s.
The final repair retains Pixi's original worker path. It checks a small
alpha sample of each Safari bitmap before parsing its atlas. Only a bitmap
that has no visible pixels is decoded again on the page; it replaces the
original only if the second decode contains pixels. Intentionally empty
atlases remain empty, and mipmaps and original files remain unchanged.
The final repair's type check and **368/368 tests passed in 17.002s**; its
production build passed (1.31s bundling). Initial focused WebKit passed
**3/3 in 334.82s**: overlay 42s, farm looks 39s and full gallery 251s
(all 98 files / 199 facings). Its source is the final `947c30a2` runtime;
that initial gallery was already imported before the new exact ground-pixel
guard was added, so the final run below separately verifies that guard.
The initial run's two final non-gallery captures were reviewed, its server
log is clean and its memory counters are unchanged.
The gallery now also compares every ground pixel before and after loading
the previously blank atlas, to catch damage to the existing scene.

## Final recovery verification at `947c30a2`

A fresh normal-runner WebKit launch passed **8/8 in 388.40s**:

| Check | Seconds | Result |
| --- | ---: | --- |
| building-overlay | 27 | Passed |
| structure-idle | 181 | Passed: all 98 files / 199 facings |
| looks | 34 | Passed |
| selected | 22 | Passed |
| team | 41 | Passed |
| playthrough-controls | 25 | Passed |
| battle-selection | 25 | Passed |
| keys | 31 | Passed |

This run includes the added exact ground guard: loading the formerly blank
`1479_chained_levelup` leaves all **2,800 sampled ground pixels unchanged**.
It waits for textured ground before the baseline and two rendered frames
after clearing the preview before comparison. All 199 facing PNGs have
identical dimensions and RGBA bytes to the previously reviewed bounded-idle
WebKit gallery. The six non-gallery final screenshots, normal selected mill,
walking outline, selected oil tower and recovery-ground screenshot were
reviewed. The scene remains full-sized with textured grass and aligned
outlines. The gallery deliberately hides town objects while extracting art;
its empty recovery-ground scene is expected.

A separate Chromium launch passed the new guard in **90s** (95.88s total).
That focused copy narrows the gallery to the formerly blank atlas's two
facings while retaining the normal mill, walking, tower transitions and save
assertions. It is **one atlas, not a repeated 98-file Chromium gallery**.
Its two facing captures and all four normal screenshots were reviewed.
The original full Chromium gallery already passed in both complete and
bounded-loading runs; the final recovery is gated to Safari.

Both final server logs have zero HTTP 5xx responses, Python tracebacks or
unhandled commands. Neither run added memory-limit, OOM or killed-process
events: cumulative counts remain 25,862 / 2 / 1, preserving the earlier
failed loading run's history. Logs, captures, the bundle/revision manifest,
exact image comparison and memory deltas are under ignored `work/idle/`.
The final runtime is `947c30a22ec45e0990520fff84ad8b99170ba756`; only delivery
documentation follows these checks before any later integration.

## Integration with tournament PR #92

PR #92 requested to finish its own verification and merge first. While
that run continued, the completed idle repair at `f9ed9060` was combined
locally with its exact candidate `f798788b6529388f918098989b8f4997eab553c8`.
The integration commit is `46f61c94b0770e2a3af80db8d47ddd319d47bfbb`.
It was not published or merged ahead of #92. The only merge conflicts were
in AGENTS.md and DECISIONS.md; both sets of guidance/results were preserved.
No structure, art-loading, input-camera or idle-gallery runtime was changed
by that integration. The tournament branch changes shared battle controls,
healing rules, spell windows and town entry, and adds four browser cases.

The combined type check passed, all **404/404 client tests passed in
15.212s**, the build passed (1.03s bundling), and the server ran **449 tests:
440 passed, nine existing skips, in 40.942s**. The complete Chromium run
finished **77/79 in 8,551.78s (2h 22m 31.78s)** on this exact combined build.
Only `collect` and `siege` failed; their evidence and follow-ups are below.
The full structure gallery passed in 862s, all five tournament cases passed,
and construction, shared battle controls, delayed unit selection, background
play, phone controls and the ground-click indicator passed. The affected
six-case WebKit run finished 5/6 in 545.66s; its additional visual finding
and page-error failure are recorded below.

PR #92 subsequently merged as `4c7f4eb559d1dac462a78c946fa1890fb4f7c9cd`.
Its final head is `cee1b96b`; comparison with the tested candidate `f798788b`
contains exactly seven Markdown files. Its own full suite passed 78/78.
The actual main merge is integrated at `485f172c`, preserving both
documentation sets. Runtime, tools, configuration and tests stayed identical
to the combined `46f61c94` build throughout both integration runs. The build
SHA-256 is recorded with the exact revision and all 79 case names.

The integrated run retains a `collect` failure at 38s: the
working-farm selection at line 37 found an empty action bar. Its screenshot
shows the empire-name dialog, and the server log records the first farm
click collecting 15 food and one experience at (42,53). The selection
helper then probes progressively higher: its final point (164,38) reaches
the HUD rename button. This is a later probe opening the name dialog,
not a level-up prompt.
The unchanged fixture starts its short farm production interval before
reloading, taking screenshots and selecting/starting the mine. By the time
it tries to inspect a working farm, the farm is ready and the click correctly
collects instead. At `862d9893`, the working-farm/ranch inspection moves immediately after
reload, before the mine and screenshots. All original assertions, production
durations and collection deadlines remain. The final WebKit collection check
passed in 102s; Chromium follow-up is recorded below. No old-main reproduction
is claimed from this source/trace diagnosis, and the failed run remains a failure.

`siege` failed in 58s at its unchanged 30-second wait for 1,800 game frames.
The screenshot shows the army still lined up with its captain's speech.
The timeout did not capture the actual game-clock value, so this result
alone does not prove the cause. The source test is unchanged from main.
A focused clock observation with the original speed, deadline and assertions
passed in 48s. During the wait the battle advanced from frame 182 to 1,800
in 27.2435s, at speed four, with the page visible and 317 then 316 fighters.
All five surviving engines selected a building at the stage transition.
This demonstrates normal progress close to the original 30-second limit
on the software renderer; it does not prove the precise clock state during
the full-run failure. No timeout is increased or hidden. The unchanged
normal-runner follow-up passed in 48s; both fresh siege captures were reviewed.

All **461 fresh Chromium PNGs** are covered by visual review. The 199 facing
images match the previously reviewed full gallery in dimensions and every
RGBA byte; the other 262 include every intermediate and final screenshot,
including both failures. Archive hashes match the reviewed files. The early
`menus/shop` capture precedes asynchronous picture loading; the later shop
captures show the loaded art. Classic retains its software-graphics warning
and start overlay. These are not described as warning-free, fully loaded
intermediate captures. No new structure artifact was found.
The archived server log has no HTTP 5xx, Python traceback or unhandled
command. Memory-limit/OOM counters did not increase during the full run.

The integrated WebKit run passed overlays (29s), gallery assertions (181s),
battle selection (30s), playthrough controls (30s) and keys (30s).
`tournament-battle` completed its gameplay assertions but failed the error
monitor after 239s on two `/friends/news` access-control errors. Its server
requests returned 200. This is retained as a failure; earlier navigation
warnings in other tests do not establish the cause of these exact warnings.

All 26 non-gallery WebKit PNGs were reviewed. Comparing the 199 gallery
captures with the prior recovery run found 198 exact RGBA matches and one
malformed image: `1479_chained_levelup`, facing zero, had a duplicated and
displaced silhouette. The visible-pixel/frame assertions passed, so that
automated pass is not treated as a clean visual result. A first 14-file
CPU/GPU probe passed in 61s and did not reproduce the malformed capture:
the repaired bitmap and a new decode had identical pixels, with 42,784
visible source pixels. That repeat did not establish a fix.

The repeated diagnostic then passed three cases (61s, 57s, 51s) and caught
the malformed frame on the fourth (36s), stopping with **3/4**. The damaged
bitmap had not been decoded on the page: it came directly from the worker
and contained visible pixels, so the empty-bitmap guard accepted it.
Its CPU frame had 42,356 visible pixels and a different RGBA fingerprint;
a fresh page decode of the identical file restored the original 42,784
pixels and correct GPU rendering. This reproduces the same malformed
silhouette as the integrated gallery, rather than relying on a later pass.

At `862d9893`, Safari always performs the existing second decode for exactly
`1479_chained_levelup-1.webp`. Other visible atlases retain the worker path,
all mipmaps remain, and Chromium's runtime path is unchanged. The gallery
also checks the affected frame's complete alpha grid: SHA-256
`69afb90c6933d8dd7c1d2a1bc5e1a6e6ebfde3bbf8a8c9f78e753179e465db62`,
independently measured from the original public WebP using Pillow. The
captured bad bitmap's alpha hash is
`4a15c044f48329042c791287bcfa94f56e8a59442169d9bad02c251517d41847`,
so the new guard rejects the actual reproduced corruption. The source
pixels, dimensions, timing and public art files are unchanged.
Types and all 404 client tests passed; the build passed in 0.790s. Server
code is unchanged from the 449-test integrated verification.

## Final repair verification at `862d9893`

WebKit passed **6/7 in 671.57s**: overlays 27s, full structure gallery 189s,
battle selection 33s, playthrough controls 29s, keys 31s and collection 102s.
The original tournament assertions completed, but its error gate again failed
at 253s on two `/friends/news` access-control page messages. A passive
trace attached after player setup saw three successful polls and no failure;
that trace misses initial page creation and cannot establish their cause.
A diagnostic with listeners attached before page creation is recorded below.
No error is ignored or assertion disabled.

All **199 gallery captures match the correct pre-integration WebKit reference
in dimensions and every RGBA byte**. The new complete source-alpha guard and
the exact 2,800-pixel ground comparison also pass. All **31 other fresh PNGs**
were reviewed, including the tournament failure and every collection state.
Selected mill/tower outlines and the moving-unit outline are aligned; the
collection captures show the intended working, ready and collected states.
No new memory-limit, OOM or killed-process event occurred in this run.

Final Chromium passed **3/3 in 255.75s**: the one-atlas alpha/ground focus
96s, collection 108s and unchanged siege 48s. This focus retains normal
mill, walking, tower-state and saved-game checks; it is not a repeat of
all 199 gallery facings. Its two facing captures exactly match the reviewed
Chromium reference, and all 11 other fresh PNGs were reviewed. The earlier
complete Chromium gallery passed in 862s and all 199 images matched the
reviewed reference exactly. Both final server logs have zero HTTP 5xx,
Python tracebacks or unhandled commands. No additional memory-limit, OOM
or killed-process events occurred in either final run.

All 79 current Chromium cases have passing results across the full run and
follow-ups. The complete run remains **77/79 on `46f61c94`**, with subsequent
Safari-only decoding recovery and test fixture/assertion changes verified
at `862d9893`; this is not a single final-head 79/79 run.

## Tournament visibility diagnostic and fixture correction

A full passive navigation trace of the unchanged tournament repeated the
failure: **0/1 in 281.51s**, test duration 274s, after gameplay assertions.
Its ten fresh screenshots were reviewed and memory counters did not change.
Both trace attempts observed successful HTTP 200 polls and no console or
request-failure event. They had omitted the separate `pageerror` event;
they did not establish that warnings occurred during initial page creation.

A smaller diagnostic then recorded `pageerror`, page lifecycle events,
`document.hidden` and native `document.visibilityState`. Ordinary reloads
produced native hidden=true/state=hidden with no error. After installing
the same synthetic hidden getter as the tournament test, two reloads
reproduced the exact `/friends/news` access-control error. At both events,
the override reported hidden=false while native visibilityState was hidden.
The stack points to the existing HUD poll; its code and the original
tournament test are unchanged from main. This reproduces a fixture causing
polls during real page unloading. It is not a structure-rendering failure.
The diagnostic retains **0/1 in 21.22s**, with both fresh PNGs reviewed.

Both background-play fixtures now return simulated hidden **or** native
visibilityState=hidden. They still withhold animation frames and check
independent background progress, explicit Pause and no time replay on return.
All assertions, speeds and deadlines remain; no error is filtered out.
Game runtime and the `862d9893` production bundle are unchanged. Focused
verification of the corrected fixtures follows below.

## Earlier runs retained

- Initial focused Chromium: 4/5. The gallery's final control incorrectly
  expected the original static Fire Tower to move. Corrected that control
  and added a verified moving tower; the failed run remains a failure.
- Initial full WebKit on `792a3bf8`: 61/72 in 71m 52.07s. Failures: hover,
  bonus, classic, construction, group, lessons-recovery, neighbours,
  pointers, tidy, villagers and work. Structure frame/outline checks passed
  in 317s, but some camera screenshots were blank; this prompted the stronger
  direct-render captures and visible-pixel assertions. No OOM or memory-limit
  counter increase occurred during that initial run.
- Old-runtime diagnostics: hover, bonus and recovery passed; group exposed
  the delayed-input bug. Construction had already finished during setup.
  Classic/neighbours produced navigation warnings. A diagnostic wrapper
  then attempted to screenshot an intentionally closed page; remaining
  cases did not run. The wrapper was corrected for subsequent diagnostics.
- Previous-main navigation baseline: tidy/neighbours reproduced their
  warnings in 121.60s. Separate classic baseline failed at Ruffle startup
  in 271.38s; it does not explain the initial classic navigation warning.
- Pre-main-#95 Chromium: 24 real passes, including the complete structure
  audit in 926s. Deliberately interrupted after 51m 26.02s when main advanced,
  to merge and rerun the combined code. Closing the browser interrupted
  dragons and generated closed-context errors; these are teardown results,
  not completed gameplay checks or a full-suite pass.
- Pre-integration server: 435 run, 426 passed, nine skips in 52.727s; client
  types and 365 tests passed in 13.075s, with a passing production build.
- After main #95: server 436 run, 427 passed, nine skips in 47.137s; client
  types and 368 tests passed in 17.437s, with a 1.01s production build.
- The first latest-WebKit launch attempt failed before running tests because
  its custom browser-cache path was omitted. It was corrected; copied stale
  output was labelled separately and is excluded from the results above.

## Visual review, logs and environment limits

All 199 pre-integration Chromium facing captures were reviewed in five
contact sheets. Every object is visible, with a finished/idle picture and
matching outline. The complete integrated gallery passed in 837 seconds;
all 199 captures are pixel-identical to those reviewed images. Normal
selected-mill and selected-tower screenshots show tight silhouettes;
the walking-outline capture is aligned.

Review also covers all 69 final non-gallery images from the complete
Chromium run, all ten final images from the affected-menu run, both contact
layouts and the 320-pixel classic bar, and the completed-town follow-up.
The latest 20-case WebKit run's 19 final images were inspected, including
its failure states. Its normal statue screenshot shows facing one; the failed extraction
concerns facing zero. Classic shows its recorded Ruffle error
page. Chromium classic has its expected software-renderer warning and
muted-start overlay over a loaded town; it is not described as warning-free.

Raw logs, all failure captures, timeline/atlas research and contact sheets
are retained locally under ignored `work/idle/`. No decompiled source is
committed. The full/affected Chromium and completed-town server logs have
zero HTTP 5xx, Python tracebacks or unhandled commands. Further final log
and image review is recorded with the final-runtime results above.

Before the decoder-only run, the cgroup had no OOM or killed-process events.
Memory-limit reclaim events increased during integrated verification from
6,117 to 9,902. The decoder-only run then exhausted memory on the 100-page
fixed-pose export: reclaim reached 25,862, with two OOM events and one killed
process. Final-run deltas after the loading repair are recorded above. The
historical high-water mark reaches 8 GiB; do not call earlier runs free of
memory pressure.
Linux WebKit does not reproduce the owner's Mac GPU or installed Safari.

## Earlier Chromium run at `cab2d7dd`: individual results

| Check | Seconds | Result |
| --- | ---: | --- |
| battle-selection | 70 | Passed |
| playthrough-controls | 57 | Passed |
| group | 126 | Passed |
| recurring-raids | 41 | Passed |
| raids | 89 | Passed |
| siege | 48 | Passed |
| structure-idle | 837 | Passed |
| hover | 57 | Passed |
| construction | 104 | Passed |
| bonus | 72 | Passed |
| pointers | 154 | Passed |
| villagers | 105 | Passed |
| work | 68 | Passed |
| looks | 195 | Passed |
| building-overlay | 166 | Passed |
| dock | 83 | Passed |
| card | 165 | Passed |
| site-menu | 144 | Passed |
| friends-help | 116 | Passed |
| gifts | 55 | Passed |
| camp | 58 | Passed |
| quest | 201 | Passed |
| nests | 129 | Passed |
| spy | 81 | Passed |
| lessons-recovery | 126 | Passed |
| animals | 56 | Passed |
| attack | 342 | Passed |
| bosses | 66 | Passed |
| bubble | 81 | Passed |
| camp-again | 33 | Passed |
| cash | 46 | Passed |
| classic | 59 | Passed |
| collect | 106 | Passed |
| collections | 39 | Passed |
| defence | 36 | Passed |
| dragons | 166 | Passed |
| edit | 79 | Passed |
| goal-window | 102 | Passed |
| graveyard | 35 | Passed |
| heroes | 54 | Passed |
| keys | 41 | Passed |
| lessons | 250 | Passed |
| lessons-phone | 282 | Passed |
| levelup | 71 | Passed |
| look | 83 | Passed |
| market | 81 | Passed |
| menus | 179 | Passed |
| messages | 29 | Passed |
| monks | 31 | Passed |
| nature | 33 | Passed |
| neighbours | 171 | Passed |
| phone-place | 84 | Passed |
| rename | 48 | Passed |
| scripted | 134 | Failed |
| scripted-bosses | 227 | Passed |
| scripted-stories | 324 | Failed |
| selected | 177 | Passed |
| shop | 88 | Passed |
| sound | 58 | Passed |
| specials | 55 | Passed |
| speed | 31 | Passed |
| spells | 90 | Passed |
| storage | 59 | Passed |
| stuck | 71 | Passed |
| survival | 92 | Passed |
| team | 85 | Passed |
| tidy | 96 | Passed |
| tools | 106 | Passed |
| tournaments | 156 | Passed |
| town-rules | 53 | Passed |
| train | 52 | Passed |
| troll-town | 59 | Passed |
| walk | 57 | Passed |
| world | 272 | Passed |

## Latest-menu integration: affected checks and failure follow-ups

| Check | Chromium seconds | Result | WebKit seconds | Result |
| --- | ---: | --- | ---: | --- |
| scripted | 159 | Failed | — | — |
| scripted-stories | 348 | Passed | — | — |
| contact | 179 | Passed | 64 | Passed |
| site-menu | 108 | Passed | 38 | Passed |
| classic | 57 | Passed | 273 | Failed |
| friends-help | 105 | Passed | — | — |
| gifts | 66 | Passed | — | — |
| rename | 50 | Passed | — | — |
| menus | 197 | Passed | — | — |
| neighbours | 196 | Passed | 60 | Failed |
| keys | 45 | Passed | — | — |
| messages | 33 | Passed | — | — |
| battle-selection | — | — | 45 | Passed |
| playthrough-controls | — | — | 27 | Failed |
| group | — | — | 61 | Passed |
| structure-idle | — | — | 50 | Failed |
| hover | — | — | 51 | Passed |
| construction | — | — | 26 | Failed |
| bonus | — | — | 20 | Passed |
| pointers | — | — | 54 | Passed |
| villagers | — | — | 26 | Failed |
| work | — | — | 50 | Passed |
| looks | — | — | 36 | Passed |
| building-overlay | — | — | 31 | Passed |
| dock | — | — | 50 | Passed |
| recurring-raids | — | — | 24 | Passed |
| lessons-recovery | — | — | 69 | Failed |
| tidy | — | — | 30 | Failed |

## Completed-town fixture follow-up

| Check | Chromium seconds | Result |
| --- | ---: | --- |
| scripted | 122 | Passed |
| scripted-stories | 150 | Passed |
