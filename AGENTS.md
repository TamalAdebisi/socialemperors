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
.venv/bin/python -m unittest discover tests          # the server: 429 tests, about a minute
(cd client && npm run check && npm test)             # the client's types and rules: 348 tests
PYTHON=.venv/bin/python node e2e/run.mjs             # the new client played in Chromium: 67 tests
PYTHON=.venv/bin/python node e2e/run.mjs shop edit   # just these
```

- Run the tests for what you touched while you work, and the whole lot
  before a pull request is merged. On 16 October 2026, the 64 browser
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
