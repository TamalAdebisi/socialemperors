# Working on Social Empires (Codex and other agents)

> **Standing owner authorization, 16 October 2026: build and merge
> autonomously.** Carry agreed work through implementation, checks,
> documentation and merge. You may merge any ready project pull request,
> including another agent's, without asking the owner again. Merging's
> automatic live deployment is authorized too. Follow the testing rules
> and the explicit owner decisions and holds in CLAUDE.md and HANDOFF.md.

This file is for coding agents that read `AGENTS.md`, such as OpenAI's
Codex. Claude did most of the work so far, so the project's rules are in
[CLAUDE.md](CLAUDE.md). **They apply to you word for word:** where it says
Claude, read "you". Read it first, then [HANDOFF.md](HANDOFF.md), which says
where the work stands and what comes next. If this file and CLAUDE.md ever
disagree, CLAUDE.md wins.

## The rules that matter most

A short copy, so they can't be missed. CLAUDE.md has them all, with the why.

- **Never commit, paste, quote or share the decompiled Flash client.** It
  is Social Point's code. Read it on this computer only, in `decompiled/`
  (git ignores it), and write notes in our own words. That goes for pull
  requests, comments and messages to the owner too.
- **No passwords, API keys or tokens** in chat or in the repository. You
  don't need any (below).
- **Test on this computer only:** never on socialemperors.me, never with
  the owner's account, never make accounts on the live site. The browser
  tests start a server of their own.
- **The original art and the original rules.** Pictures and sounds come
  from the game's own files; the new client sends the same commands as the
  Flash client and does what it did. When unsure, read the decompiled client.
- **Judgment calls in writing:** in DECISIONS.md (newest first), in the
  pull request and in your final message.
- **Light on spoilers** in reports: what works, what changed, what you
  decided. No walkthroughs, and pictures only when the owner has a decision
  to make.
- **Plain words.** The owner isn't a programmer by trade and wants to learn:
  say what you did and, in a sentence, why.

## Setting up

`tools/setup.sh` does everything, and is safe to run again: the server's
Python packages into `.venv`, the new client's packages, Playwright with
Chromium for the browser tests, and the decompiled Flash client
(`decompiled/SocialEmpires0926bsec/`, about a minute, with a Java JDK). It
takes about 15 seconds without the decompiling.

### Codex in the cloud: the environment's settings

Set once, by the owner, in Codex's settings for this repository's
environment:

| Setting | Value | Why |
| --- | --- | --- |
| Package versions | Python 3.13, Node 22 (22.18 or newer), Java 21 if offered | What the live server runs; Node 22.18 runs the client's TypeScript tests as they are; Java builds the decompiler |
| Setup script | `bash tools/setup.sh` | Runs with the internet, before you start |
| Maintenance script | `bash tools/setup.sh` | Runs when a saved container is reused: picks up packages that changed since |
| Agent internet access | On, allowlist *None* plus the domain `assets.socialemperors.me`, methods GET, HEAD and OPTIONS | The browser tests take the game's pictures from the live art bucket. Reading only: nothing else is needed |
| Environment variables, secrets | None | Nothing in the work needs a key |

If `javac` is missing after setup, the script says so and skips the
decompiling. Then the setup script needs a JDK first, for example
`apt-get update && apt-get install -y openjdk-21-jdk-headless && bash tools/setup.sh`.

What the setup script sets in its own shell (an activated `.venv`, say)
doesn't carry over to your commands, so always name the project's Python:
`.venv/bin/python`, and `PYTHON=.venv/bin/python` for the browser tests
(below).

### Codex on a computer (the CLI or the app)

Run `tools/setup.sh` once in the repository. It needs Python 3.13, Node
22.18 or newer, the internet, and a Java JDK 11 or newer for the
decompiling. The browser tests start a local server and a browser, so let
those commands run outside the sandbox when asked.

## Testing

```
.venv/bin/python -m unittest discover tests          # the server's unit tests, about a minute
(cd client && npm run check && npm test)             # the client's types and rules
PYTHON=.venv/bin/python node e2e/run.mjs             # the new client played in Chromium: 95 tests
PYTHON=.venv/bin/python node e2e/run.mjs shop edit   # just these
```

- **Latest combined integration is not yet verified:** special-building
  `a75d1e05` and latest main `a0f3ab19` are merged locally; the combined
  tree contains 95 browser cases. Previous special-building 86/86 and
  menus' 88/89 plus corrected focus remain attributed to their own exact
  revisions. Exact clean `2f7eb080` passes 467 server tests run (458 passed,
  nine existing PostgreSQL skips), client types and all 479 client tests.
  The complete 95-case browser run remains required; no special-building
  merge/deployment is claimed.
- **Latest combat-controls verification (#98):** server 449 run (440 passed,
  nine existing PostgreSQL skips), client types and all 408 tests passed.
  Complete Chromium attempted all 80 cases in two isolated 40-case shards
  at `5b544c2b`: 70 passed and ten failed. Final isolated follow-ups passed
  **10/10 in 15m 19.58s** at `daa2d2c7`; all 80 have passing results across
  runs, not one final-head 80/80 run. Linux WebKit combat controls passed
  **1/1 in 89s**. All full/focused captures and complete server logs were
  reviewed. [The controls record](docs/verification-combat-controls.md)
  retains every failure, fixture correction, exact revision and visual limit.
- **Latest menus/progression verification (#99, #105–109):** server 449
  run (440 passed, nine existing PostgreSQL skips), client types and all
  436 tests passed. Full combined Chromium: 88/89 in 1h 59m 26.250s at
  `76b1663f`, including main #98. The no-hall villager fixture needed to
  acknowledge the new warning before selecting the worker underneath.
  Test-only `6fcf0646` retains all assertions and passes 1/1 in 1m 24.643s.
  All 89 cases have passing results across runs, not one final-head 89/89
  run. All 516 full-run screenshots and both focus captures were reviewed;
  complete browser logs are clean. Merged runtime/art/tests are identical
  to `6fcf0646`. [The delivery record](docs/verification-menus.md) retains
  exact timings, initial failures and screenshot limits. All six slices
  are merged; the owner's manual run-through and other feature holds stay.
- **Latest structure verification (#96):** server 449 run (440 passed,
  nine existing skips), client types and all 404 tests passed. Complete
  combined Chromium: 77/79 in 2h 22m 31.78s; final collection, unchanged siege
  and one-atlas alpha/ground checks passed 3/3 in 255.75s. All 79 cases have
  passing results across runs, not one final-head 79/79 run. WebKit's full
  structure gallery passes all 98 files / 199 facings with exact reference
  images. The seven-case run was 6/7; a reproduced test visibility bug caused
  its tournament polling errors. After correcting the fixtures, WebKit
  tournament/controls passed 2/2 in 289.41s, and Chromium controls passed 1/1
  in 68.31s. All seven selected WebKit cases have passing results across runs.
  Game runtime remains `862d9893`; final fixture commit is `ab8c3d60`.
  [The delivery record](docs/verification-96.md) retains every failed run,
  exact revisions, screenshot review, the earlier construction timing limit
  and the Linux WebKit/Mac GPU distinction. No error or test was disabled.
- **Tournament implementation and required verification are complete.**
  Exact clean `f798788b6529388f918098989b8f4997eab553c8`, including
  main `8f8c57ab`, passed **78/78 browser cases in 92m 33.33s**.
  Server: **449 run (440 passed, 9 existing PostgreSQL skips)**;
  types and **393 client tests passed**. All tournament cases, shared
  spells, team and scripted bosses passed. The server log is clean;
  all 260 fresh archived screenshots were reviewed, with concrete visual
  limits retained in the record. All 22 review threads are resolved
  and independent final source reviews found no new issue. Cubic's quota
  and Qodo's paused trial prevented fresh automated re-review; no required
  check was reported or bypassed. [The delivery record](docs/verification-92.md)
  preserves screenshot coverage, exact timings and prior failures, including
  the unresolved cause of the historical 47 quest reload failure. The
  current pass does not claim to fix it. PR #92 records release metadata;
  no merge or deployment is claimed by these test results.
- **Previous playthrough verification (#95):** server 436 run (427 passed,
  9 existing skips), client types and all 357 passed after review. Complete integrated
  Chromium: **73/73 in 1h 23m 18.88s** on game code `10507be4`, including
  #94. WebKit selection, recurring raids, cards and Everybody passed
  **4/4 in 2m 37.96s**. Test-only rendering/save waits and a central click
  target follow the full run: card passed in Chromium (111s), and final
  selection passed in Chromium (50.22s total) and WebKit (21.77s total).
  Review corrections at `ad9adfd7` have fresh server/client passes, affected
  Chromium **8/8 in 7m 2.97s**, and WebKit **3/3 in 1m 31.96s**.
  Automated re-review found zero new issues. [The delivery record](docs/verification-95.md)
  retains the initial results, failures, screenshot review and engine limits.
- **Previous playthrough verification (#94):** server 435 run (426 passed,
  9 existing skips), client types and all 354 passed. Full Chromium suite:
  **67/71 in 1h 52m 56.27s**; four failures and their follow-ups are recorded,
  with all 71 cases now having passing results across the full/focused
  runs. Game code stayed at `01ddd0cd`; subsequent edits are tests/docs.
  WebKit buildings, controls, hover and Friends/Menu passed **4/4 in
  3m 50.48s**. [The delivery record](docs/verification-94.md) retains the
  original failures, exact checks, screenshot review and Mac GPU limit.
- **Latest art verification (#91):** all 20 images match their JSON and
  repair-query copies, both plain and with the game's Origin header.
  With refreshed caches, `team` passed alone (52s) and in the full suite
  (42s). The pre-#93 full run was **66/67 in 79m 48.48s**; its historical
  tutorial-arrow failure is recorded in [the repair notes](docs/art-loading-repair.md).
  Peak anonymous/shared/kernel memory was 3.76 GiB, with no memory-limit
  or OOM events. After merging #93, the cold-cache team passed again in
  66s, followed by all four tutorial/tournament checks in 10m 28.77s.
  Current server: 435 run (426 passed, 9 existing skips); client types
  and all 350 passed. The art follow-up is closed.
- Latest tutorial verification in [#93](https://github.com/TamalAdebisi/socialemperors/pull/93):
  **69/69 browser tests passed in 64m 32.58s** on game code `20a87d8d`.
  Later tutorial recovery/review corrections passed all three tutorial
  checks and tournaments **4/4 in 8m 15.30s** on game code `6754695a`,
  plus types and all 350 client tests. Server: 435 run, 426 passed,
  9 existing skips; a later test-only assertion tightening passed all
  14 tutorial server tests again. The full browser run used the repaired
  ordinary public art with the old nine-item cache refreshed.
- **Previous full verification (#87):** all 67 browser tests passed in
  **80m 30.65s**, including the build, on the machine below. Server:
  429 run (420 passed, 9 existing skips); client types and all 348 passed.
  [The delivery record](docs/verification-87.md) has the exact code commit,
  screenshots reviewed and individual timings. Its stale art-cache
  result is historical; #91 supplies the refreshed-cache verification.
- Run the tests for what you touched while you work, and the whole lot
  before a pull request is merged. For #86 on 16 October 2026, the 64 browser
  tests took **64 minutes 51 seconds**, including the build, on a cloud
  machine with 2 CPUs and 8 GiB of memory (Python 3.13.5, Node 24.19.0,
  Playwright 1.56.1). 63 passed; `team` hit the memory limit while loading
  an oversized art bundle (HANDOFF.md, task 1). Several tests use multiple
  towns and take three to five minutes. Chromium draws without a graphics
  card here, so allow over an hour for the full run.
- **Look at the screenshots** in `e2e/out/` (and the server's log there).
  A test can pass while the screen is wrong.
- Every new feature gets a browser test that checks the screen and the
  server's save. New players come from `newPlayer` in `e2e/lib.mjs`, which
  marks each as a different visitor, so the limit of five new accounts an
  hour doesn't get in the way.
- Wait for things to happen, not for a number of seconds: the slow drawing
  makes fixed waits flaky. The survival test waits for its displayed game
  clock; the market test lets earlier messages finish before asking for
  a warning, so the message queue has room for it. Both waits have a
  30-second limit (HANDOFF.md, task 1).
- Never skip, switch off or loosen a test to get a pass.

## Delivering work

- **One slice, one branch, one pull request.** A slice is about a task's
  worth: a window, a rule book's gaps, a feature. Start from the latest
  `main`, on a branch named `codex/<topic>`.
- **The docs change with the code:** CLIENT.md (how the client works),
  ROADMAP.md (status), PARITY.md (tick what you fixed), the status lines in
  `docs/original/` for the classes you built, and DECISIONS.md for any call
  you made.
- **Before the pull request:** merge the latest `main` into your branch (a
  merge, not a rebase), keep both sides where the docs clash (DECISIONS.md
  stays newest first), and run the tests again.
- **The pull request,** as a draft, in the shape the earlier ones used:
  *What changed*, *Judgment calls (also in DECISIONS.md)*, *Tests* (what
  ran, how many passed, and any failure explained). Plain English: the
  owner reads it.
- **Merging is part of the task:** the owner's standing authorization
  covers your own pull requests and another agent's. Complete the checks,
  resolve conflicts, mark the pull request ready and merge it without
  asking for confirmation. **Merging deploys the live game**: Railway
  rebuilds `main` in about two minutes; that deployment is authorized.
  Fix regressions and record accepted unrelated failures accurately.
  Never bypass required GitHub checks. If a real blocker prevents merging,
  report what failed and the next concrete step; do not leave ready work
  unmerged just to seek permission.
- Never push to `main` directly, and never rewrite a branch someone else
  is working on.

## What you don't need

- **No Railway, Supabase, Cloudflare or GitHub Secrets.** The live server
  deploys itself when `main` changes; the database and the art bucket need
  nothing from you. If a task seems to need them, stop and say so.
- **New sprite sheets** (buildings, units, effects) are made by the *Export
  art to R2* GitHub Action, which the owner starts by hand. All of the
  game's sheets are made already; if one turns out wrong or missing, say
  which and why.
- **Interface icons** are different: `tools/art/export_ui.py` draws them
  from the game's file into `client/src/ui/art/`, and they're committed.
  That you can do (it needs the JDK and Pillow, which setup installs).
