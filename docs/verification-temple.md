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
- Full server/browser verification and latest-main integration are owned
  by the coordinating chat before delivery. No merge is claimed here.

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
16.711 seconds for the combined type/test command). The complete
**85-case Chromium run remains pending** in the integration record;
the focused WebKit pass does not establish a full-suite pass.

The screenshots alone do not prove storage-box priority or a walking
dragon's last saved position; the passing browser assertions check both.
There is no dedicated screenshot of the already-walking dragon at
confirmation or uncertain-save recovery. Some final controls lie below
the captured scroll position. Linux WebKit is not a real iPhone or Mac
GPU comparison. Local review hashes and notes are retained in the
integration worktree's ignored `work/review-webkit-temple.json`.
