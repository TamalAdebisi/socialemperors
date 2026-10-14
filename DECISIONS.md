# Judgment calls

Calls made on the owner's behalf while building, newest first, so any of
them can be found and reversed. The big, agreed decisions are in
[ROADMAP.md](ROADMAP.md#decisions-so-far).

## 14 October 2026: the menus, and the servers

- **The owner picked option 3, the rail and dock**, after comparing it
  with option 1 with the menus open. CLIENT.md ("The menus: rail and
  dock") describes it for Beta 1's first slice. In the comparison, Claude
  added a Neighbours button to the rail and the dock, and the phone's dock
  has World (which holds Quests and the battle modes) in place of separate
  Quests and Battle buttons, so five fit.
- **Moving the servers to Singapore is waiting on a backup.** The live
  server still keeps every account and empire in SQLite on its own volume,
  and neither volume had a backup or a backup schedule. Backups can only
  be made from Railway's dashboard, so the owner makes one first
  (DEPLOY.md 6.3, now with that step). Staging's move is staged in
  Railway, not yet applied.

## 14 October 2026: tidying up, ground rules, browser tests

- **Removed what the fork left behind:** the Windows bundle's build scripts
  (`build/`, the PyInstaller part of `bundle.py`), two Flash Player
  installers (42 MB, `distr/`; FLASH.md links Adobe's archive instead), the
  old releases and Linux pages (their Linux steps are now in FLASH.md), two
  game settings files for other versions of the game that nothing read, a
  script for making settings patches whose input file was gone, and two
  pictures no page used. All of it is still in git's history.
- **Kept:** `mods/` (the server can still apply a mod to everyone's game;
  none is switched on), the built-in neighbours in `villages/`, and the
  import of single-player saves.
- **`bundle.py` is now `paths.py`:** it only says where the server's
  folders are, now that there's no bundle.
- **README:** rewritten for socialemperors.me. The original project's
  download and Discord badges went (they point at its releases and its
  community, not ours); it's credited instead, with the GPL's note that
  the code has been changed.
- **Browser tests:** each test player says it's a different visitor through
  a header that only the test server listens to, so the limit on new
  accounts doesn't block a run.
- **Home page:** the new client's description now says you can build and
  run your town in it, not just look.

## October 2026: the new client's look

- **Food is a carrot** (the owner asked for something vegetarian), drawn in
  the game's style, without a face. To undo: add `"food": ("IconResourcesMC", 2)`
  to `tools/art/export_ui.py` and remove `client/src/ui/art/food.svg`.
- **Icon files** are at most 160 pixels on their longest side, as WebP at
  quality 90: 220 KB for all of them instead of 552 KB, with no visible
  difference at the sizes they're shown.

## October 2026: shop, storage and editing

- **Cutting trees and mining rocks** stay in the classic game until units
  walk in the new client; selecting a tree says so.
- **Messages at the top** queue up, at most three waiting, each shown for
  2.5 seconds, so a quick run of taps doesn't flood the screen.
- **"Remove" instead of "Sell"** on anything that gives nothing back.
- **The shop's pictures** are the Flash client's own; when one is missing,
  the client draws the building itself instead.
