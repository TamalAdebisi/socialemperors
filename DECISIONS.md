# Judgment calls

Calls made on the owner's behalf while building, newest first, so any of
them can be found and reversed. The big, agreed decisions are in
[ROADMAP.md](ROADMAP.md#decisions-so-far).

## 15 October 2026: Beta 2, the island map

- **The Quests window is the game's own island map,** in the panel on the
  right (a sheet on phones), scrolling sideways through its seven pages,
  rather than a list. On a wide screen this one panel is wider than the
  others (a whole page of the map, up to 740 pixels), so the islands'
  names can be read; on a phone a page is 560 pixels wide and scrolls
  within the sheet. It opens on the furthest island reached.
- **Tapping a locked or resting island says why** under the map (the
  original showed an alert window).
- **The team picker is part of the start window,** not a window of its
  own: the 20 places, then your units to tap; the god islands' rule and
  the "fewer than 20?" question are said in the window.

## 15 October 2026: Beta 2, battles and the first islands

- **Quests are played in the new client** from the Quests button: the
  troll islands, the civilization islands, and the hardcore and god
  islands. The boss islands and the Hero Isle (whose doors open as you
  clear each part) say "Played in the classic game for now", with a link,
  until their slices.
- **Extras, which change neither the rules nor the look:** a Speed button
  (1x, 2x, 3x), Select all (or Space) since the original's box tool needs
  a mouse, Shift to add a unit to the selection, and Escape to let go.
  Life bars also show for 3 seconds after a hit, not only on the selected
  or hovered unit, so you can see who's hurt.
- **The report is sent when the results show,** not when you press a
  button on them, so closing the page then loses nothing. The original
  waited for "Share" or "Skip".
- **The island waits behind the start window,** as in the original; the
  window shows the army sailing (with its pictures) and the game's own
  stars.
- **Same seed, same battle:** chance in battles comes from one function
  that tests can seed (the page still plays at random), and the battle's
  timers count its frames, so the Speed button speeds everything. Part of
  the plan for the server checking battles one day (CLIENT.md).
- **Quirks of the original kept:** the chest's prize isn't cut by the
  island's gold cap (it's paid outside a kill); a unit with no attack that
  falls isn't counted; walls give 1 experience.

## 15 October 2026: Beta 2, the last sprite sheets

- **The biggest pictures are stored at half size** (a quarter for the
  largest), and drawn back at full size. A picture bigger than 4,096
  pixels can't be loaded on most phones; at the game's usual zoom the
  difference hardly shows.
- **A budget of 4 sheet pages per item.** The chained water god (a giant
  animated decoration) would have needed 48 pages, more memory than a
  phone's graphics chip has. It is now stored at a quarter size and its
  animation shows each picture for 2 frames instead of 1 (15 a second
  instead of 30): a little softer and choppier, but it loads. Only items
  over the budget change; the 1,575 sheets already made stay as they are.
- **A stray part far away is cut off.** The medieval slayer has a part
  placed 15 million pixels from it (invisible in the game); the sheet keeps
  the 4,096 pixels around the slayer.
- **The projectiles and effects are exported too** (one small sheet per
  projectile), since battles need them; still the game's own pictures.

## 14 October 2026: the art export

- **11 sprite sheets wait for Beta 2.** The export made 1,575 of 1,587; the
  rest are top dragons, gods and bosses that need a change first (a picture
  too big for a sheet, too slow to draw, or a crash; CLIENT.md, Step 1).
  Nobody owns them in Beta 1's fresh start, and the likely fix for the big
  ones touches how the client lines pictures up, which Beta 1 was changing.
  They come first in Beta 2, where bosses matter.
- **Each item gets its own drawing process and two hours** (it was five
  items to one hour, which silently lost the biggest ones). An item stopped
  by the limit now says so in the log.

## 15 October 2026: the selected unit's pointers

- **On a computer, the original's pointers:** with a unit selected, the
  mouse pointer becomes the game's axe over a tree, pickaxe over a rock,
  and red arrow over a building it can go into, as in the Flash client.
- **On a phone (your pick):** there's no pointer, so the same picture pops
  up for a second over the tree, rock or building the unit was sent to.
  The other idea, an axe over every tree as soon as a villager is
  selected, would clutter a big town.

## 14 October 2026: Beta 1, launch preparation

- **Arthur's lessons are offered, not forced:** a new player in the new
  client is asked once a visit, until answered, whether to take Arthur's
  lessons in the classic game or skip them. The lessons are the original
  game's and are built around a fresh town, so the question comes first
  thing. Skipping sends the same report the Flash client sends when they
  end, which also puts the player on other players' world maps.
- **The live server's move to Supabase is yours to start,** because you
  sign up first to become the admin, and today's players would meet an
  empty game. DEPLOY.md 6.4 has the steps, with the new
  `SE_COPY_SQLITE=0`.
- **AcidCaos's village is gone,** as agreed. The tests that used it now use
  Arthur's first town, which players can also visit and help now.

## 14 October 2026: Beta 1, sound and speed

- **The music and sound buttons are in the top bar,** the Flash client's
  own pictures (it kept them in a small options panel). Both start on, as
  in the original; your choice is remembered in each browser.
- **The music waits for your first tap,** because browsers don't let a page
  make sound before then.
- **A sound for a building turning ready** plays while you're playing, not
  for everything already ready when the town opens (browsers would block
  those anyway).
- **Compression is on for everything the server sends as text,** the
  classic game included: browsers unpack it for Flash and Ruffle as well.

## 14 October 2026: Beta 1, neighbours

- **Arthur's portrait** is the game's own king picture, as in the Flash
  client (which showed a princess instead to players who said they were
  women; the server doesn't keep that, so it's always the king). The other
  neighbours keep their letter portraits.
- **Visiting shows your own numbers** in the top bar, as the Flash client
  did, with "Visiting <name>" beside them.
- **The cart asks with a bar** at the bottom (Let it in / No thanks) rather
  than the Flash client's window; tapping a waiting cart asks again.
- **A server fix:** letting a cart in used to lose its help on the server,
  so nothing arrived. Fixed and tested.
- **AcidCaos's built-in village stays for now;** it goes at launch with
  the fresh start (the next slices), as ROADMAP.md says.

## 14 October 2026: Beta 1, missions and bonuses

- **Where the goals' requirements come from:** the config has the goals'
  titles and gold, but what each asks is only in the Flash client. Claude
  read that list on this computer and wrote it as our own data,
  `client/src/rules/goals.json` (our names for each kind, the numbers it
  needs), not the client's code. The decompiled client stays uncommitted.
  If you'd rather not have even that, the goals could be written out by
  hand from their texts instead.
- **The daily bonus waits for a tap:** a bobbing button at the top right,
  rather than opening by itself on load as the Flash client's did after
  its tutorial. Monday's and the welcome-back chests the same.
- **One goal card**, the next one, bottom left beside the rail; tapping it
  opens all 15. The Flash client showed a few on the left; here they'd
  cover the town.
- **Goals for battles, quests and the like** stay in the list and say
  they're played in the classic game for now.
- **A message per goal paid** ("Goal reached: … +10 gold"), not one when
  reached and another when paid, so they don't crowd out other messages.

## 14 October 2026: Beta 1, land and cash

- **Land is bought by tapping it** (the original also had an Expand tab in
  its shop that did the same); the offer shows both prices, and the gold
  one says how many neighbours it needs.
- **The bank opens from a + on the gold and cash pills,** a small green
  button in the game's style, rather than the game's wide "Add Cash"
  picture, which said cash on the gold pill too.
- **"Not enough gold" just says so;** the original also offered its
  payment page, which is the bank here, a tap away on the +.

## 14 October 2026: Beta 1, training and population

- **The Train button is the unit's picture with its price under it** on
  the selected building's card (the original showed the same picture on
  its info panel), and a cash button beside it.
- **The people count is in the top bar** as a sixth pill (people / room),
  and in the Army window.
- **Kept from the original:** wonders count twice towards the room for
  people, and a unit in training doesn't take room until it's out, so two
  buildings training at once can go one over.

## 14 October 2026: Beta 1, villagers at work

- **A server fix:** two villagers at one tree got a fifth more wood from
  the server than the Flash client showed. The server now gives what the
  client shows, for trees and rocks only.
- **A mine waiting for its working time** asks how long when tapped, as
  before; that question now also offers Let out, so a worker can be taken
  back out without choosing a time.
- **Let out** takes the last unit to go in, one per tap, from the
  building's card (the original showed each unit's portrait).
- **Moving a building keeps its units inside;** selling or storing it lets
  them out first.

## 14 October 2026: Beta 1, units walking

- **The path finder is a correct one.** The original's has a slip in its
  arithmetic, so it doesn't add up the length of the way so far and its
  paths can wander a little. Ours finds the shortest way, with the same
  rules for what blocks a unit and the same 8 directions. A unit gets to
  the same place; its path may be a little straighter.
- **A unit's stop is sent as it stops,** in the next batch, rather than on
  a separate 6-second timer: the same command, sooner.
- **Selected units glow** like selected buildings, instead of the
  original's mark under their feet.

## 14 October 2026: Beta 1, the menus

- **Neighbours' button picture:** the game has none of its own for it, so
  it's the villager portrait the site's Friends button already uses (from
  the game's art).
- **Neighbours' portraits:** their initial on a colour of their own, as in
  the mockup; the original showed Facebook pictures, which are gone.
- **Visiting shows the player's username**, as the neighbours list does,
  not "Emperor" (every empire's name in its save). A small server change
  (`get_neighbor_info`); the save itself is left as it is.
- **Where the phone layout starts:** below 720 pixels wide, or held upright
  up to 1000 wide, so a tablet held upright gets the dock.
- **The glove collects everything at once.** In the original it was a mode
  where each tap collected; here one press collects all that's ready, and
  it only shows when something is, with how many.
- **Pressing a lit menu button again closes its window**, besides the close
  button, Escape and (on phones) dragging the sheet down.
- **The Army window lists the town's units** until training comes; Quests,
  Battle and World open the classic game for every mode, as agreed.
- **Extras:** keyboard shortcuts (B, S, A, Q, W, N, C, Escape).
- **Browser tests fetch the art themselves:** the bucket only lets the
  game's own site read it, so the test windows fetch it and keep a copy in
  `.tools/art-cache/`.

## 14 October 2026: a fresh start at Beta 1

- **The built-in neighbours** (`villages/`, shown to players with fewer
  than seven neighbours): the owner keeps **Arthur's** villages, and would
  like Arthur's town to keep changing over time as it did in the original
  game; find out from the original how it did, and do the same (Beta 1's
  neighbours slice). **AcidCaos's** village (the first project's creator)
  goes at the launch, along with the tests that use it.

- **The owner's call:** when the live server moves to Supabase, at Beta
  1's launch, it starts empty. Today's accounts and empires (the first
  project's creator's, the test accounts) stay behind, and the owner and
  friends start from a clean slate.
- **Claude's suggestions, in the plan:** a setting to skip the automatic
  copy from SQLite (built as part of the launch); the owner signs up first
  and is made admin through `SE_ADMINS`, so no password passes through
  Claude; test accounts stay on staging and in the browser tests, so the
  live game holds real players only.

## 14 October 2026: the menus, and the servers

- **The owner picked option 3, the rail and dock**, after comparing it
  with option 1 with the menus open. CLIENT.md ("The menus: rail and
  dock") describes it for Beta 1's first slice. In the comparison, Claude
  added a Neighbours button to the rail and the dock, and the phone's dock
  has World (which holds Quests and the battle modes) in place of separate
  Quests and Battle buttons, so five fit.
- **The servers moved to Singapore**, nearer most players. Claude held
  off at first: the live server keeps every account and empire in SQLite
  on its own volume, neither volume had a backup, and backups can only be
  made from Railway's dashboard (DEPLOY.md 6.3 now starts with one). The
  owner made the move from the dashboard at 18:34 UTC. Checked afterwards:
  both volumes are in Singapore, and the live server loaded the same 4
  player empires as before the move, from the same database.

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
