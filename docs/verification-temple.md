# Supreme temple verification, 17 October 2026

The special-building slice adds the original Supreme temple window and
ritual to the modern client. Browser checks use a local throwaway server
and accounts. Original artwork is read locally or from the public art
bucket; no production game state is used.

- Client types and all **410 client tests** pass after review corrections
  (8.71 seconds), including six focused temple checks. The preliminary
  408-case suite also passed before the two review regression checks.
- Existing temple server replay: **7/7 pass** (0.073 seconds). The server
  retains its pre-existing unclosed-file/database ResourceWarnings.
- Focused Chromium screen/save case: **1/1 pass**, **199 seconds** for
  the scenario, at exact clean
  `9bfa2581634af70f26588e69d4cf958308fe74fa`. The build also passed
  (Vite 0.590 seconds). No failed attempt preceded this pass.
- At this initial stage, full server/browser verification and latest-main
  integration remained with the coordinator. Final combined checks are
  recorded below; no merge is claimed here.

All **10 fresh screenshots** were reviewed: original laws, desktop
offerings and wait, phone saved wait, sacrifice confirmation, phone
Heart before/after offering, completed-but-waiting ritual, ready ritual
and reset after reload. The art, marks and readable text are intact,
with no horizontal overflow or dock overlap on the phone. This verifies
the responsive panel, rather than an exact reproduction of the old
760-pixel Flash window. The long offering list and final action scroll
within the panel.

The server log has no Python traceback, HTTP 5xx or unhandled-command
entry. The regression required a real dragon still walking at sacrifice
confirmation and found it absent in the server save; the shared mana,
phone Heart action, both retained Heart boxes, final deadline, store-first
consumption, free reward, unchanged claim XP/currency and reset on reload
all passed. The local account data was retained at
`/tmp/se-e2e-l5VPcS`. Screenshots and complete logs are archived locally
in `work/temple-verification-9bfa2581/chromium/`.

Runtime, CSS and art are identical to `917bfcfc`; `9bfa2581` only tightened
the browser test to make the actual Heart offering on the phone. The
later verification-record commit changes documentation alone.

The browser fixture uses the original admin wait command between
independent stages, avoiding a two-day real-time test. It asserts that
the ordinary window exposes no wait shortcut. Remaining historical
progress is prepared through existing commands; the screen/save checks
cover mana, one walking sacrifice, a phone Heart action with both storage boxes, the
final wait, and claim/reset.
The unit test pays all twelve offerings in reverse order and verifies
every sacrificed dragon and exact payment.

Judgment calls are in DECISIONS.md: keep the admin-only skip hidden; use
the project's responsive panel with original art and text; show the
original illustration without the four-second cosmetic playback.

## Combined integration follow-up

The temple case passed **1/1 in 160 seconds** in local Linux WebKit at
exact clean `22f5fd02bc900ba9ca674da7a591a9c79b0197c4`. All **10 fresh
screenshots** were reviewed: laws, desktop offerings/wait, saved phone
wait, sacrifice confirmation, phone Heart before/after offering,
completed wait, ready ritual and reward/reset. Original art, marks,
readable text, the phone countdown and dock layout are intact. The
original-resolution reset image shows the full “Progress 0/12” caption;
an initial preview-based clipping observation was incorrect and was
withdrawn. No caption or CSS change was needed. The reviewed image and
its archived copy share SHA-256
`4c22c078465bf55b6fbc54ddfa5e7d841ddd00164db2388067a6d967f504274a`.

These results verify the **combined integration**, not a new isolated
temple-leaf run. After the focus follow-up, integrated `db5d614d` passed
**467 server tests: 458 passed, nine existing skips** (34.338 seconds
for the tests; 34.938 seconds for the command). Client types passed and
all **447 client tests** passed (13.265896 seconds for the tests;
16.711 seconds for the combined type/test command). At that stage, the
planned **85-case Chromium run was still pending**; the later complete
86-case result including main #98 follows below. This focused WebKit
pass alone does not establish a full-suite pass.

The screenshots alone do not prove storage-box priority or a walking
dragon's last saved position; the passing browser assertions check both.
There is no dedicated screenshot of the already-walking dragon at
confirmation or uncertain-save recovery. Some final controls lie below
the captured scroll position. Linux WebKit is not a real iPhone or Mac
GPU comparison. Local review hashes and notes are retained in the
integration worktree's ignored `work/review-webkit-temple.json`.

## Combined verification before the menus merge

Exact clean `56d1bdbeb895b9eaed1b1a1804bea19a8a2cca78`, including main #98,
passed **86/86 Chromium cases in 8305.262s**; temple passed in **176s**.
All 507 fresh run captures were reviewed and matched the archived
filename/hash manifest; the complete 78,774-line server log has no
recorded server error. These are combined results, not a new isolated
full run of the temple leaf. Prepared ritual stages and visual limits
above remain unchanged.

Product source for that 86-case run matches clean `b6ed5175`: **467 server tests run, 458 passed,
nine existing PostgreSQL skips**, types and **451 client tests passed**.
The earlier `db5d614d` retains its 447-test result. Selected Linux WebKit
cases have passing results across the initial 5/6 and affected 2/2 repeat,
not one final-revision 6/6. The later test-only `a75d1e05` legacy Soul
follow-up and remaining delivery checks belong to
[the integration record](verification-special-buildings.md). The temple
queue stays unticked until its delivery is merged; no deployment or
Mac/iPhone GPU result is claimed.

Menus/progression main `a0f3ab19` was then integrated at `2f7eb080`, which passes
467 server tests run (458 passed, nine existing PostgreSQL skips), client
types and 479 client tests. The complete Chromium attempt at clean
`f3c55854` was **94/95 in 9197.418s**; `shop-details` failed on the phone
preview after 111s. Its unchanged complete repeat passed **1/1**, 113s
scenario / 119.515s command, at the same clean revision. All 95 have passing
results across these runs, not a single 95/95. All **561 + eight fresh PNGs**
and the complete **90,317 + 875 server-log lines** were reviewed; exact
capture/log/resource results belong to
[the combined integration record](verification-special-buildings.md#latest-main-integration-and-current-release-checks),
not a separate full run of this leaf. The failed attempt stays retained;
the repeat does not establish its cause. Prior results keep their exact
revisions; no merge or deployment is claimed.

Latest privacy/art-setting main `f9946077` was integrated at clean
`3d60b898`. Server **467 run, 458 passed, nine existing PostgreSQL skips**
passed (34.317s tests; 34.947s command); client types and **479 tests**
passed (13.41462159s tests; 16.53s command). The missing-art-setting guard
returned its expected **exit 2 in 0.078s**, before build/server/browser.
The configured positive Shop focus then **failed 0/1** on the desktop
preview (51s scenario; 66.807s command), and its read-only diagnostic also
**failed 0/1** (57s scenario; 68.667s command). These exact-revision failures
are retained separately from the unchanged passing `f3c55854` repeat.
Incoming main `f88ea31f` (#113) owns the preview-clock correction and
click-only Details/short labels. Exact clean `dc920d60` passes server **467 run, 458 passed, nine existing
PostgreSQL skips** (34.438s tests; 35.004s command), client types and
**480/480 client tests** (14.191369192s tests; 17.54s command). The final affected Chromium check passes **9/9 in 1780.184s (29m 40.184s)** at
clean `dc920d60`, including this slice and the changed Shop/Storage/preview
paths. All 74 fresh captures and the complete 10,029-line server log
were reviewed and hash-checked. This is a combined affected check, not a
new full 95-case run or a separate full leaf run. Exact case timings,
resource receipts, archive/audit hashes and visual limits are in
[the integration record](verification-special-buildings.md).
No merge/deployment is claimed.
