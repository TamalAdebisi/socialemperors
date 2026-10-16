# Working on Social Empires

> **Standing owner authorization, 16 October 2026: build and merge
> autonomously.** The owner authorizes agents to complete the agreed
> roadmap and merge any ready project pull request, including another
> agent's, without further merge confirmation. Implementation, testing,
> documentation and merging are one task. The automatic deployment from
> merging into `main` is authorized. Explicit feature decisions and holds
> still apply; routine implementation and merge decisions are yours.

Social Empires, the Facebook game, playable again at
[socialemperors.me](https://socialemperors.me). A Python server plays the
part of Social Point's old one; players use the original Flash client (in
Ruffle or a Flash browser) or our new client in `client/`, which is being
built to replace it. Start with [README.md](README.md), then
[ROADMAP.md](ROADMAP.md) and [CLIENT.md](CLIENT.md).

## The owner's ground rules

The owner set these in October 2026. They hold for every task.

1. **Test everything yourself.** Unit tests, the server's tests and the
   browser tests (below), plus looking at the screenshots. The owner doesn't
   test: they play when a beta is ready. Test on this computer only, never
   on socialemperors.me and never with the owner's account.
2. **Light on spoilers.** The owner wants to relive the game. Reports say
   what works, what changed and what you decided, without walkthroughs or
   pictures of things they haven't reached. Show pictures only when they
   have a decision to make (designs, layouts).
3. **Judgment calls in writing.** When you decide something the owner might
   care about (a rule the original leaves unclear, a design choice, removing
   something, an extra), say so in the task's final message and the pull
   request, and add it to [DECISIONS.md](DECISIONS.md), newest first.
4. **The original art, always.** Buildings, units, icons, windows and
   sounds come from the game's own files (`tools/art/`). The only exceptions
   are ones the owner asks for, like the carrot (`client/src/ui/art/food.svg`).
5. **The original rules, too.** The new client sends the same commands as
   the Flash client, so both play the same empire. When unsure how the
   original behaves, read the decompiled client and do what it does.
6. **Extras are your call.** Speed, tooltips, shortcuts and small
   conveniences that change neither the rules nor the look: add them and
   list them.
7. **Explain as you go.** The owner isn't a programmer by trade and wants to
   learn: plain words, and a sentence on the why behind anything technical.

## Never

- Commit, paste, quote or share the decompiled Flash client. It is Social
  Point's code: read it on this computer only (`tools/decompile_client.sh`,
  into `decompiled/`, which git ignores). Write notes in our own words.
- Put passwords, API keys or tokens in chat or in the repository. They live
  only in GitHub Secrets and Railway variables.
- Make accounts on the live site. `e2e/run.mjs` starts a server of its own.

## Order of work

Phase 4 of the roadmap, in three stops. Each is built in slices, about one
task each, and every slice ends tested, documented and merged.

- **Beta 1, the town builder.** The menus as a rail and dock, the
  layout the owner picked (CLIENT.md, "The menus: rail and dock"), units
  walking, villagers at work, training and population, land and cash,
  missions and bonuses, neighbours, sound and speed, then a full
  run-through against the Flash game. Players can then use the new client
  for everything but battles.
- **Beta 2, battles and quests.** First the last 11 sprite sheets (big
  dragons and bosses; CLIENT.md, Step 1, says why each failed), then
  combat, defending a town, spells and heroes, the island map, the quests
  in batches with their bosses.
- **The switch.** Battles against players, the long tail, the tutorial and
  polish; the new client becomes the default.

ROADMAP.md (Phase 4) says where things stand.

## Testing

```
python -m unittest discover tests     # the server
cd client && npm run check && npm test  # the new client's types and rules
node e2e/run.mjs                      # the new client, played in Chromium
```

`node e2e/run.mjs [test ...] [--no-build] [--keep]` builds the client,
starts the server on a free port with a throwaway data folder, and plays
each test in `e2e/tests/`. Each test player is a new account with a new
town; a header tells the test server they're different visitors, so the
limit of five new accounts an hour doesn't get in the way. Art comes from
`art/sheets/` when it has been made here, otherwise from the live bucket.
Screenshots and the server's log go to `e2e/out/`: look at them. Each new
feature gets a browser test, with checks on the screen and on the server's
save. Set `PYTHON` to a Python that has `requirements.txt` installed.

## Where things are

- **Server:** `server.py` and a module per part of the game; commands in
  `command.py`. Tests in `tests/` replay what the Flash client sends.
- **New client:** `client/src/rules/` the game's rules (no drawing,
  unit-tested), `view/` drawing with PixiJS, `ui/` the windows in HTML,
  `net/` talking to the server, `editor.ts` ties them together.
- **Art:** sprite sheets made by `tools/export_art.sh` and uploaded to
  Cloudflare R2 by a GitHub Action; the interface's icons by
  `tools/art/export_ui.py` into `client/src/ui/art/`.
- **Docs:** README.md (index), ROADMAP.md, CLIENT.md, DEPLOY.md,
  MULTIPLAYER.md, FLASH.md, DECISIONS.md. HANDOFF.md says where the work
  stands between agents (Claude, Codex); AGENTS.md is this file for Codex.
- **The map of the original:** `docs/original/`, what every part of the
  Flash client does and how far the new client has got. Look a feature up
  there before building it (its rule book, and the rules with no button),
  and update its status when it's built.

## Style

Code and docs read like the code and docs around them: plain English,
short sentences, comments that say why. Keep the docs up to date in the same
change: CLIENT.md for how the client works, ROADMAP.md for status.

## Pull requests

Work on a branch, open a draft pull request, and merge it into `main` once
the required verification is complete. The standing authorization covers
all agents and both their own and other agents' pull requests. Mark ready
and merge without asking again; do not stop at a draft when the work is
ready. Merging deploys the live game (Railway rebuilds `main`), and the
owner has authorized that deployment.

Fix regressions, resolve conflicts with the latest `main`, and record
test results honestly. Keep already accepted unrelated failures and
their follow-up work documented; never describe a failing check as a
pass, skip or weaken a test to merge, or bypass required GitHub checks.
If a real blocker remains, explain the failure and the next concrete
step. A request for merge permission is not a completion step.
