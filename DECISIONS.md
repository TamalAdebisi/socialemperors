# Judgment calls

Calls made on the owner's behalf while building, newest first, so any of
them can be found and reversed. The big, agreed decisions are in
[ROADMAP.md](ROADMAP.md#decisions-so-far).

## 16 October 2026: verifying the building card and Menu

- **The phone card leaves a row for the pointer tools below it.** The
  taller parchment covered them in the browser screenshots. It now uses
  the available width and sits above the tools, keeping the owner's
  chosen card and dock layout.
- **Lifting a finger keeps the upgrade price open.** Touch sends a
  pointer-leave event before each click; clearing the preview there made
  every tap act like the first. The second tap now completes the upgrade,
  as the existing design intended, with a browser check of its saved cost.
- **The tutorial's progress count sits inside Arthur's instruction
  bubble.** Its fixed position crossed the taller card in a passing
  test's screenshot; keeping it with the instruction makes both readable.
- **Browser checks use the environment's proxy when configured.**
  Playwright does not pick it up itself; art requests otherwise fail in
  this cloud environment. The throwaway game server stays on localhost.
  No assertion or game rule changes for this setup.
- **Read-only responses do not renew the login cookie.** The Menu's
  logout check caught a late image response restoring the cookie after
  logout. It is now renewed when the session changes; the 30-day expiry
  runs from signing in or the last session change, not every image or
  news request. A server regression test reproduces the old behavior.
- **Map checks keep the card visible.** Test targets move into the open
  or use a visible part of the selected picture. They keep the other
  agent's selection checks without hiding controls to click through them.

## 16 October 2026: standing authorization to build and merge

- **The owner authorizes autonomous delivery of the agreed roadmap,**
  including merging any ready project pull request, whether written by
  Codex, Claude or another agent. No further merge confirmation is needed;
  the automatic deployment is authorized too.
- **Verification stays part of delivery.** Resolve conflicts, fix
  regressions, inspect screenshots and document results and accepted
  unrelated failures. A ready draft should be marked ready and merged.
- **Parallel checks use separate environments and the same commit.**
  One coordinator owns integration and merging. Browser runs share too
  little memory to overlap on the current 2-CPU, 8-GiB machine.
- **Existing explicit holds remain in place,** including task 6's final
  comparison against the Flash game.

## 16 October 2026: browser test waits

- **The owner requested merging #86 with the separate `team` failure
  documented.** Both changed tests pass. The oversized art bundle still
  needs the repair and verification recorded in HANDOFF.md; no test was
  skipped or weakened.
- **Survival waits for three seconds on the displayed game clock,** so
  the existing check for at least three seconds in the save still holds
  on a computer that draws slowly.
- **Market warnings wait for earlier messages to finish first.** Goal
  rewards use the same queue, which drops new messages when full. Both
  warning checks wait for an empty queue, each with a 30-second limit.

## 16 October 2026: the site's links in the new client

The owner left where they go to me ("whatever is optimal").

- **One gold Menu, after Full screen** (after Classic game on a phone),
  holding Friends, Empires and Log out: three more buttons would crowd the
  top bar on a phone, and these are used now and then, not while playing.
- **The Friends count shows on the Menu itself,** so a request or a gift
  is seen without opening it; Friends opens in a new tab, as on the
  classic page, so the game plays on.
- **Classic game and Full screen stay where they were.**

## 16 October 2026: the building card

- **The card is the original's info panel,** the owner's pick (mockup
  A): its parchment, frames, bars, buttons and words from the game's file.
- **No Sell on the card,** as in the original (its slot there was
  Upgrade): selling is the bulldozer's, in the pointer's menu, which asks
  first as before. Ours had added Sell to the card.
- **Upgrade on a touch screen:** the first tap shows the bubble with the
  next building and its level or price (a mouse sees it by hovering), the
  second upgrades. The original upgraded at once, its price shown only
  on hover.
- **Hurry up opens the game's hurry window** (Ask for help, or Buy for 2
  cash), as the original's; ours had both buttons on the card itself.
- **The time bar also shows training and building,** with the time left
  under it: the original showed those only on the map.
- **A wonder's tip has its numbers filled in** ("increases the 175
  population limit by 20"): the original's card left the blanks showing,
  its shop filled them.
- **A tap on a unit inside lets that one out,** as the original's
  portraits; the bar's single Let out button went with the old card.

## 16 October 2026: gifts

- **Gifts sits first in the Neighbours window,** as the original's Send
  gift sat on a neighbour's portrait; the window is the classic page's,
  in the panel.
- **One Gifts row, not Send gift on each neighbour:** the window lets
  the player pick the friend, as the classic page's does.
- **The site's bar (Empires, Friends, Log out) isn't in the new client
  yet:** where it goes on the owner's layout is theirs to say. (Since: a
  Menu, "the site's links in the new client" above.)

## 16 October 2026: the troll town

- **Towns has its own button,** on the rail from level 20 (on a phone,
  a row in World): the original's globe sat in its games menu, which our
  rail split into Quests and Battle.
- **Travelling opens the other town as a new page** (`?town=1`), the way
  an island trip does here; the original swapped the town in place. The
  page's address keeps the town, so reloading stays there.
- **The other town shows its name and race only,** not its level or
  resources: the original's window showed the two pictures alone.

## 16 October 2026: a goal's window

- **The goal card opens its goal's window,** as the original's goal
  badges did; until now it opened the list. The list is a tap further:
  the window's Goals button, in the place of the original's switched-off
  "pay to skip".
- **Opening a goal's window doesn't open the shop.** The original opened
  its build menu too for goals 1 to 10; here the shop would cover the
  window, so HELP! points at the Build menu instead.

## 16 October 2026: collection pieces

- **A piece is the player's at once,** as the wood and gold from a
  harvest already are here; the original dropped it on the ground to be
  tapped (and picked it up by itself when six things lay about).
- **A message names the piece and its collection** (the game's names),
  an extra: the original showed the name only with the mouse on the
  dropped piece, and there's no collections window here yet to see it in.

## 16 October 2026: survival

- **Each arena's prizes are listed on its card,** not only while the
  mouse is over it, so they read on a phone too (an extra).
- **Speed works in the arena** (an extra), and the time held is the
  game's own, so playing faster changes nothing but the wait: the waves
  come faster too, and pausing stops the clock, as in the original.
- **Every enemy keeps at the relic.** In the original, one could turn on
  whoever hit it, but its next thought sent it straight back to the
  relic, so in play they never left it.
- **Losing count of summoned enemies:** the original counted every enemy
  that fell, summoned ones too, towards the next wave; here only those
  the arena sent count.

## 16 October 2026: friends' help at a building

- **Ask friends sits on the card,** beside finishing the work for cash.
  The original showed both in a small hurry window; our card already
  offers the cash one directly, so the ask joined it.
- **A friend's picture is their initial on a colour,** as in the
  neighbours' list: the site keeps no pictures of players (the original
  showed their Facebook photo).

## 16 October 2026: the market

- **In the panel, not a window in the middle.** The original's market
  was a window over the town; ours opens in the panel like every other
  building's window (the menus' layout the owner picked), with the
  game's own trade cards and words inside.
- **The warning names the right good.** The game's line for selling
  more than the town has always said "wood" (the text had no place for
  the good); ours says food or stone when it's those.
- **Buying without the gold opens the bank,** with "Not enough gold: it
  takes ...", as every purchase here does; the original opened its own
  gold window.
- **A day's trades can start again while the window is open,** if 20
  hours pass since the last trade: the server already counts that way;
  the original waited for the next load.

## 16 October 2026: naming the empire

- **The way in is the level at the top.** The Flash client's top bar
  showed the town's name and opened the window when tapped; our top bar
  (the owner's pick) has no room for the name, so the level, whose tip
  names the town, opens it.
- **Save works.** In the original only Enter saved (the button's action
  was removed in that build); here both do.
- **30 letters at most,** so the name fits where it shows.

## 16 October 2026: spying

- **The continents keep counting up from 1** (the owner's call): the
  original counted down from 50 to 1, its "King of the World" at 1. So
  the map's first-time help, which says "Try to make it to Island 1",
  is left out.
- **The eagle sets off from the top-left corner,** with no corner to
  pick, as the original's spy start showed none.
- **Spying is offered from the world map only,** as in the original (the
  neighbour bar had Attack, not Spy); home after it opens the map at the
  continent spied on, as the Flash client went back to it.
- **Attacks on players of the same level, or higher, count when left
  early too,** as the original counted them; "attack a player" still
  needs the battle fought to the end.

## 15 October 2026: the world map

- **Each island shows its owner's name and level** under it, not only in
  its menu as in the original, so the map reads on a phone too (an
  extra).
- **The map is a panel beside the town,** like the quests' map, not a
  screen over everything; its pieces are the game's own.
- **The island menu explains itself in our words** ("Already attacked:
  wait 4 hours...", "You need an army..."); the original's own labels
  for these were drawn into its art, not in the game's texts.
- **Attack is the menu's link to the battle page,** so the attack is
  counted when the battle opens, as from Neighbours.
- **Islands and profiles show the player's username,** not the town's
  name ("My Empire" for nearly everyone): the original showed the
  Facebook name, and the username is ours.

## 15 October 2026: the defence plan and the battle results

- **The plan is a tab of the Army window** ("My Defensive Strategy"), as
  the Flash client's options window had the army and the plans side by
  side.
- **A defender's report shows no units lost for good,** since this
  server never takes them (see 15 October), even though the report the
  attacker's game sent counts some as lost.
- **"Attack a neighbour" counts any neighbour that's a player or one of
  the villages that ship with the game,** not only friends from the
  Friends page: the client can't tell those apart, and the original's
  "friends" were simply the people in the neighbour bar.
- **The attacker's username goes in the defender's history,** not
  "Emperor", so the defender knows who it was.

## 15 October 2026: attacking players in the new client

- **Attack is in the Neighbours window, from level 6.** The original's
  neighbour bar offered Attack at any level, but its Battle button
  stays locked until 6; the new client keeps both to 6.
- **Every attack counts, wherever it starts.** The original's neighbour
  bar didn't take one off its counter until the town reloaded; here the
  count is read fresh before each attack.
- **The defender's race comes from their saved town,** not the
  original's guess of "human" for neighbours, so a troll town keeps its
  trolls in the battle.
- **The report is sent as the results open,** not when the player
  presses OK, so nothing is lost if the page closes there (as the
  islands do).
- **Bought attack packs aren't offered:** the server has never sold
  them, so nothing opens that window.

## 15 October 2026: placing on a phone

- **A tap shows where it would go; a tap on it puts it there.** The Flash
  client never ran on phones: a mouse showed the building under the
  pointer before a click bought it. On a phone the first tap now does
  what the pointer did, and the prompt says "then tap it again". Moving a
  building works the same. A mouse still buys with one click.

## 15 October 2026: the level-up window

- **One button, OK.** The original's window had Share (posting to
  Facebook) and Skip, and both only closed it here; Facebook is gone.
- **The prizes are paid as the levels are reached,** then the windows
  follow one by one; the original paid each as its window opened. The
  totals and the save are the same.

## 15 October 2026: hovering and the collecting bar

- **The popup over what the mouse is on is drawn over the town.** The Flash
  client drew it on the ground, under the buildings, so a building's front
  could hide its own name and bar. Same for the collecting bar.
- **Fading what stands in front isn't built.** When the mouse is where
  several pictures overlap, the original lights one of them (not always
  the one a click picks) and fades the others; we light the one a tap
  would pick and fade nothing.
- **The bulldozer's hover shows the popup too,** as the original's does
  (its highlight is the same one), with the ground outlined in white.

## 15 October 2026: attacking players, the server's checks

- **A fourth attack in 6 hours is recorded but pays nothing,** rather
  than being refused: the Flash client's own checks happen in places the
  server can't see (the neighbour bar and Revenge don't count), so a
  refusal could break an attack the classic game allowed.
- **The defender still loses nothing** when attacked (no units, no
  gold), as `pvp.py` already chose; what Social Point's server did isn't
  known. They earn a tenth of each attacker their town killed, as before,
  now in the town that was attacked.
- **Honour comes from the armies, not the report,** so an empty report
  earns 1, the least any battle gives.

## 15 October 2026: the special units' counted beats

- **As the original played, slips included, where a player would have
  seen them:** Godzilla's small stamp throws every time (its code meant
  1 time in 10).
- **One slip not copied:** in the original, the Lythos Titan stopped
  making specials for the rest of a battle if it rolled its minions while
  they were still out. Here it rolls again next time.
- **The Tiny Water God's grab holds its victims for a while** (a web),
  rather than leaving them helpless and unseen on the field for good, as
  a slip in the original did.
- **Two more slips not copied:** the Evil Scorpion's plain hits on a
  building stopped the original's count (they hurt the building here),
  and the Elf Priest handed its converts back to the computer's side even
  when it was the player's.
- **Not built yet, so not decided yet:** Tornado Heaven, which in the
  original hit a thrown unit about 30 times while it flew. This and the
  other missing parts are listed per unit in
  `client/src/rules/specials.json` ("beats").
- **"Up close" is measured as the original measures it,** by the larger
  of the two tile gaps (a diagonal 2 tiles off counts as 2).
- **Hits the original repeated on a unit in the air are folded into
  one:** the original moved a thrown unit only when it landed, so a
  quick series of strikes kept finding it; ours moves it at once. Where
  that mattered, the readers wrote the total as one hit (the Eagle
  Rider's wing, the Red Bull's smash).
- **Burning hurts once a second,** as the original's "5 a second for 5
  seconds" reads.
## 15 October 2026: construction

- **Units bought from the shop stand in scaffolding too,** the 1x1 one, for
  the same 10 seconds. The rule book said buildings; the Flash client's
  code marks anything bought (a unit placed from storage comes as it is).
  Meanwhile the unit can't be sent anywhere: nothing in the original's
  code stops one walking off in its scaffolding, which we took for an
  accident.
- **The bar is drawn over the scaffolding,** at the same spot. The original
  drew it on the ground, under the building, where a scaffold's front
  posts can hide the percentage.
- **The scaffolding sheets keep every other frame** (15 a second instead of
  the game's 30), about a megabyte for all six, each fetched only when
  something of its kind is built. The troll town's scaffolds wait for the
  troll town.

## 15 October 2026: the nests' window

- **The nest's window opens in the panel,** like every window in the new
  client (the layout the owner picked), with the original window's parts
  stacked down it rather than its wide parchment popup.
- **Hire friends lists the friends here,** as the classic page's Ask
  friends window does; the original sent a Facebook request.
- **Friends' help is a short "Congratulations!!" with OK,** not the
  original's list of the friends' pictures.
- **The monster nest's window has no line under its button.** The
  original never filled it in for monsters (only the dragons have "Press
  take care every 6 hours...").
- **The step pictures live in the client** (1.7 MB, ten strips, each
  loaded only when its nest is opened), so they don't wait for an upload
  to the bucket.
## 15 October 2026: progress as the original keeps it

- **No more opening buildings early.** The original has a price for it
  but never wired the shop's "Level N" tag to it, so players couldn't; ours
  offered Unlock on every locked card. Unlocks already in a save still
  count.
- **Reaching level 35 stops the goals** and gives a free Wizardry Academy,
  with a short message of ours ("Your goals are done!...") where the
  original showed its notice about the spell book. **The spell box** that
  takes the goals' place from level 35 is still missing (it's missing on
  loading too).
- **Goal doings count only while a goal of their kind is open,** the
  working-time goals keep the last time chosen, and goal 18 counts the
  nearest 20 units within a 3-tile circle, as in the original. Island goals
  still read the stars from the save (a call kept from 15 October).

## 15 October 2026: units walk the whole map, trees grow in the wild

- **Units walk anywhere on the map but under buildings, as in the
  original.** This client kept them on the bought land; the map of the
  original showed its paths take the wild ring and land not yet bought
  too. It reverses "the player's own units still go only on their land"
  (wild animals, 15 October) and makes "A unit off the bought land may
  cross land that isn't bought to get back" (villagers getting stuck)
  simply true of every unit. Tapping land for sale with a unit selected
  sends it there, as in the original; without one, the land is offered.
- **Trees, rocks and animals grow in the wild ring and on land not yet
  bought, never aimed at the player's own,** and after the camp is up.
  Villagers walk out to them. A town's own land gets no new trees: as in
  the original.

## 15 October 2026: town rules from the map of the original

- **Moving a building now lets its units out, as in the Flash client.**
  This reverses "Moving a building keeps its units inside", further down:
  the map of the original showed it changes the save (their work stops),
  and PARITY.md asked for the original's rule.
- **A harbour still waiting for its crew isn't staffed by the client.**
  The original sends 20 free helpers to one; our server opens the harbour
  and the zeppelin tower on the next load without a crew list (social.py
  keeps staff only for the six that fill up again), so none ever waits.
- **The Nursery's own work is still missing** (with two of a kind inside,
  a copy comes out when it's collected). It wasn't on the parity list; it
  stays with the classic game for now.

## 15 October 2026: Arthur's lessons in the new client

- **Skipping the lessons gives no nest and no draggy**, as in the
  original, where they came only at the end. The question at the bottom
  says so before the player chooses.
- **Our own words in the second half.** The original's goals part (the
  farm, the villager into it, three trees) showed only an arrow; Arthur
  says a line at each step here, so a player knows what's wanted.
- **The wood is the player's as the tree falls**, so the step "pick up
  the wood" passes by itself: the new client has no wood token to tap.
- **Buildings go where they fit.** The original asked for the house and
  the farm on set tiles; if something stands there (a villager, say), the
  arrow shows the nearest free spot instead.
- **Nothing is frozen.** The original stopped other units during the
  lessons; here the town goes on as usual, and the camera follows the
  arrow (again if what it points at walks under Arthur).
- **The goals window is closed by the player** before the next step, with
  the arrow on its close button, so they get to read it.
- **The nest's gift steps have no wait.** The server now takes the seven
  free steps of the first egg without starting the care timer, as the
  original's gift did.
- **A reload carries on** from the start of the lesson it was in; the
  browser remembers "under way at step 15", because 15 alone is also what
  skipping sends.
- **Quiet while learning:** the camps' story window and the first
  villager's welcome wait until the lessons are over. The original's "new
  town" window is left out: the question at the bottom does its job.
## 15 October 2026: the map of the original

- **The notes name the original's classes and files** (and its server
  commands and config keys), so a reader can find the code again on their
  own computer. Nothing else of it: no code, no line-by-line translation,
  no long quotes of the game's text.
- **A rule only counts as a difference once a second reader has checked
  it.** Of 113 claimed, 110 held and are marked "(checked twice)"; the 3
  that didn't were corrected in place, not dropped.
- **"Already the same" in PARITY.md was wrong about opening buildings
  early:** it's switched off in the original. Corrected there, and added
  to the list of rules to fix with the others the map found.
- **The rules that change the save went to PARITY.md;** those that only
  look or feel different stay in the rule books for their slices.

## 15 October 2026: the pointer's tools

- **Collect all stays,** beside the original's glove: one press collects
  everything ready. The glove (Fast collect, in the pointer's menu) works
  as the original's, collecting what it's swept over.
- **On a phone the glove sweeps with a finger:** dragging collects what it
  passes instead of moving the map. The original only ran on computers.
- **The glove stays on until it's put down** (Cancel, Escape or the square
  tool). In the original, the first press on the map made it look put
  down while it went on collecting.
- **Escape puts a tool down,** as it does the square tool.

## 15 October 2026: villagers getting stuck

- **A unit off the bought land may cross land that isn't bought to get
  back.** Ours otherwise keep units on the land. The Flash client's path
  finder doesn't seem to look at the land at all (from reading its code),
  so its units could walk back from a fight at a camp.
- **A unit stopped short by something built in its way tries once more**
  from where it stopped, instead of working from there (the original
  checked it was close enough first).
- **The tidy-up keeps units on the land, and no longer leaves one standing
  on a gate,** where it couldn't move while the gate was shut.
- **Left as in the original:** trees growing back can still surround a
  villager (it can chop its way out), and a unit let out of a building or
  trained may still be put in a closed-off gap.

## 15 October 2026: selecting several units

- **A group sent to the ground only gets tiles it can walk to.** The
  original handed out any tile with nothing on it, so a unit could be
  given one off the bought land and stay where it was.
- **A unit choosing where to stand by a tree, a building or an animal skips
  tiles other units are already walking to,** so villagers sent together
  (or one after another) each get a tile of their own instead of stacking
  on one.
- **Escape puts the square tool down,** as it closes everything else here.
  The original had no Escape for it.
- **A portrait under the mouse glows,** but its unit on the map doesn't
  light up as in the original (there's no hover highlight on the map yet).

## 15 October 2026: Beta 2 checked against the original, the town and the islands

- **Island goals count the stars the save keeps.** The original counted
  only wins made in the same session; here the island and the town are
  separate pages, so that would never count. A player who already won an
  island gets its goal at once.
- **Kept ours: nothing counts after an island is decided.** In the
  original, deaths and pay went on being counted in the few seconds
  before the results, and on the hardcore, god and Hero islands each later
  fall paid the win bonus again (a bug).
- **Kept ours: the Arctic Isle counts its lent units rightly.** The
  original miscounted the lent Wizard and knights, and could call the
  battle lost too early.
- **Kept ours: units of any race on the border walk home** when a camp
  clears it. The original sold them (a Stone Golem, a Yeti, a ship...).
- **Kept ours: a unit sent where it can't reach is freed.** The original
  left it ignoring enemies until the next order.
- **Not yet: neutral things as enemies on some islands.** The original's
  rule would send units to chop trees and cows; it waits for a look in the
  Flash game (PARITY.md, Beta 2).
- **The browser tests hold back the siege a town may meet as it opens**
  (`seCalm`, set only by `e2e/lib.mjs`): it locked tests' towns at random.

## 15 October 2026: Beta 2 checked against the original, spells and special moves

- **The Ether Shield protects the square it shows.** In the original a
  slip in its code made it protect one size bigger than its marker at
  ranks 1 and 2, and nothing at all at rank 3. Ours protects the marker's
  5, 7 or 9 tiles, as the spell's picture promises.
- **Fire Havoc falls inside its marker.** In the original it fell two
  tiles up and to the left of it (the same slip: half the area taken off
  twice), sometimes on the player's own units.
- **A LIMIT clears the buttons' cooldown, as in the original.** It reads
  like a side effect of the original's code rather than a design, but
  players met it, so it stays.

## 15 October 2026: the welcome-back chest, in both games

- **Your call: the chest stays in both games.** The classic game has
  offered it since Phase 2 (we switched it on in our copy of the Flash
  client); the new client had removed it because the original had it off.
  It's back in the new client, so a new empire gets it whichever it plays.
- **As the classic game does it:** from level 4, on the empire's first
  three days, three chests to pick on the 2nd and 3rd day; on the first
  day (or once the 2nd day's is opened) the window says what tomorrow's
  holds. Our earlier version had no window on the first day and one chest
  instead of three.
- **Its button is the game's own "Reward" box** (exported from the Flash
  file), where Monday's chest uses the game bar's gift box.
- **The daily bonus is decided as the town opens,** as in the original:
  reaching level 5 mid-visit shows it on the next. The chest does show on
  reaching level 4, as the original's did.

## 15 October 2026: what's selected is marked

- **The glow is gone:** a selected thing is marked only as in the Flash
  client, a golden ring or outline under it and its life bar over it (the
  owner asked for the original's look). This reverses "Selected units
  glow", further down.

## 15 October 2026: Beta 2, the harbour, the zeppelin and pausing

- **The new client gives the harbour and the zeppelin tower,** as the
  Flash client does when the town opens, rather than the server. So a
  town played only here gets them too.
- **They're placed where they fit whole.** The original checked a 3 by 3
  space for these 4 by 4 buildings, so they could overlap something.
- **"Dock operative!" is a line at the top,** not a window with a
  picture, so it doesn't stand in front of the camp's window as the town
  opens.
- **A monk's turning lasts the fight at home.** When a fight in the town
  ends, a unit of the player's still turned is the player's again, and a
  turned enemy that isn't in the save (a raider) goes with the fight. The
  original kept them turned until the page was opened again.
- **Pausing pauses whatever is open.** The original didn't pause on
  losing focus while one of its windows was open; ours don't stop the
  town beside them, so the game pauses anyway.

## 15 October 2026: Beta 2, the graveyards

- **A list, not pages of six.** The Graveyard's units and the heroes show
  as rows in our side window, like every other window here, rather than
  six (or four) at a time with arrows.
- **In the shop's order.** The original listed the fallen in no set
  order; ours follow the shop.
- **The potion pack is 100 cash for one potion,** the price this server
  already used (from the project we forked). Social Point's real price
  isn't known.
- **Our own words when there isn't the cash for potions:** the game's
  text for it is missing from its files.
- **The original's quirks kept:** a unit brought back for gold costs its
  whole price in food too; a hero comes back, or is bought at the altar,
  without a check on room for people, and its experience comes again.
- **The Altar of Heroes needs the altar:** its window opens from the
  altar's card, so a hero always stands beside it (the original could
  also send one to storage).

## 15 October 2026: Beta 2, scripted camps (part 3)

- **A festival's steps show in order:** two keys taken show the first two
  steps, whichever keys they were. The original showed the step of each
  key taken (the second and third, say).
- **An opened festival goes, like any chest.** The original left it
  standing, still, until the town was opened again.
- **A troll town isn't given the fireworks camp's human helpers** (they
  would stand as enemies after a reload). Its prize, the Dragon Statue,
  still goes to storage, as in the original.
- **No camera flights:** when the dragon or Neptune gets away, or a door
  opens, the camera stays where the player put it.

## 15 October 2026: the server's message as the town opens

- **It shows in the bar at the bottom, with OK,** where the new client asks
  everything else, rather than in a window of the original's own look.
- **It comes before the carts and Arthur's lessons,** one after another,
  so one doesn't hide the other.

## 15 October 2026: Beta 2, scripted camps (part 2)

- **A camp's helpers stand by the town hall.** The original put them in
  the map's top-left corner (its search for a spot came back empty), from
  where they walked to the town hall.
- **A camp's progress is saved before it ends.** Three camps (the
  Atlantis treasure, the portals, the wizards) saved their last key after
  ending in the original; the server now ignores that too (part 1).
- **No messenger speech or camera flight** when a camp's window closes;
  the original flew the camera to a helper who said a line, or to the
  chest.
- **Kept from the original:** each time the town opens, a newer camp's
  corners are cleared and put back, its guards and boss whole again.

## 15 October 2026: Beta 2, scripted camps (part 1)

- **Camp 13 reloaded in its last stage keeps the chest shut** until the
  wave of skeletons has fallen. The original opened it at once on a
  reload, wave or not.
- **The camera doesn't fly to the chest** when the camp's window closes,
  as the original's did; the chest lights up when its turn comes.
- **A camp found in a muddle** (its chest gone with keys left) is put up
  afresh. The original cleared the border and ended it.
- **Left out, as in the original:** camp 7's food prize (always 0) and
  camp 13's two prize skeletons (never given).

## 15 October 2026: Beta 2, the rarer special moves

- **Ghost copies aren't drawn:** the Red Hot dragon's and the Ether
  Messiah's copies strike where the original's flew, but no see-through
  dragon flies there.
- **The Ether Messiah's copies do their slash as six small hits** (5
  each, once a second), as close as we could read the original's.
- **Who can be cursed or turned goes by the unit's kind:** under 500 life
  in the config, as the original decided when the unit was made.
- **The cursed werewolf pays nothing and isn't counted,** like a summoned
  unit; the unit it replaced counts as fallen.

## 15 October 2026: Beta 2, battle music and the alert

- **The "under attack" alert's words are ours** ("Your town is under
  attack!"): the original's were drawn into its picture. Its button keeps
  the game's own word, Help.

## 15 October 2026: the keyboard

- **The arrow keys move the map; WASD doesn't any more.** Both were our
  extras clashing (S, A and W also open Storage, Army and the World map);
  the original moved the map with the arrow keys only, and its letters were
  developer keys.
- **Space turns a building while it's placed or moved,** as in the
  original; elsewhere Space does nothing yet (the original's square tool
  for picking several units comes with "Selecting several units").

## 15 October 2026: tidying a town as it opens

- **Paths and other terrain take no tile** when tidying, as when placing
  here, so nothing built over a path is put away.
- **A building's footprint is the same whichever way it faces,** as when
  placing here; the original turned it for this check only.
- **The villager for a town with none** comes once Arthur's lessons are
  taken or skipped (the original waited for its tutorial to end).
- **The browser tests start each town with a villager** far off in the
  wild corner, so none appears near the middle where tests tap; one test
  checks the villager comes.

## 15 October 2026: Beta 2, the Rockdriller and the dragons

- **Kept from the original:** the Rockdriller goes back to 25,000 life when
  it gives up, whatever the stars (at 2 and 3 stars that's half its life).
- **The Crimson Scale's bombing runs follow the path finder,** so they're
  straight lines only where the arena is open, as in the original.
- **Its eggs hatch where they land without a flight on screen;** the
  original drew the egg flying.
- **The Dangerous Isle's sea isn't turned black.** The original darkened
  the background there; here the island looks like the others.
- **Each hit on the Rockdriller counts towards its grudge,** and the
  grudge list forgets the fallen at once (the original kept dead
  attackers on the list unless they were at the top).

## 15 October 2026: Beta 2, the Yeti and the Golem

- **The Stone Golem's life at levels 15 to 19 stays the original's 1,900**
  (3,800 at 2 and 3 stars), though it was surely meant to be 19,000. That's
  how those levels played it.
- **A lit key is collected the moment it's tapped.** The original filled
  a short bar first (two thirds of a second).
- **The last key's penguins count like the others:** they keep the battle
  going and aren't lost. The original forgot them, so it could call the
  battle lost while they still stood. Penguins that fall are never taken
  from the player's own.
- **The bosses think like the other fighters.** The original gave them a
  mind of their own that differs in small ways: it picked a new target a
  little later, and looked around only every two seconds.
- **The yeti's and golem's moves are close, not exact:** the rain of
  stones falls around its target (the original's fell in a square ahead
  of the boss), and the small yetis appear around it (the original's at
  four corners 3 tiles off).

## 15 October 2026: Beta 2, Hero Isle

- **Kept from the original:** an enemy that stands in none of the
  island's seven parts (the nine by the landing, and every copy at 2 and 3
  stars) counts against the first part, so its door can open before its
  own heroes are all dead.
- **Monks now turn units on every island** (4 each, 24 seconds apart, none
  with 500 life or more, no boss): an enemy turned counts as beaten and
  pays; one of the player's turned counts as lost. At home they don't
  turn anyone yet.
- **An enemy a monk turned that then falls isn't reported as the
  player's loss.** The original reported it, so the server took one of the
  player's own units of that kind (their own Warrior Princess, say).
- **An enemy counts towards the win once,** even if monks turn it back
  and forth. The original could count it twice and pay the win's bonus
  twice.

## 15 October 2026: Beta 2, troll camps

- **Ten of the thirty camps are built in the new client:** those the
  original lays out by its own code. The other twenty are scripted
  stories (with their own steps and bosses); while one is due, the new
  client leaves it to the classic game, which puts it up in the same
  empire. If the classic game has put one up, the new client leaves its
  chest alone too: those chests open by their story, not when the
  enemies are gone.
- **The server ignores a raid's progress sent before the raid has
  started.** Three scripted camps (the Atlantis treasure, the demon
  portals, the corrupted wizards) send their last progress just after
  their chest; kept, it made the next camp finish by itself on a reload,
  for free. This fixes it for the classic game too.
- **A chest at level 26 pays like level 27** (750 gold, 100 experience).
  The original's table skipped level 26, so its chest paid nothing.
- **Kept from the original:** a camp still standing is put up afresh,
  somewhere else, the first time the game opens in a session (its window
  shows again; a "session" here is a browser tab), not on coming home
  from an island or a visit (corrected after the Beta 2 check); the
  border is cleared for it, trees included; every enemy unit on the map
  must be beaten before the chest opens, the border's trolls included.
- **A fight with a camp starts when units are sent at it.** In the
  original, camp and border trolls also attacked anything that strayed
  within 10 tiles; here walking near them doesn't start a fight.
- **Each enemy unit killed at home pays 5 gold**, camp and border trolls
  too, kept by the server (the original showed it and never saved it), on
  top of the experience the server already gave for them.
- **A fight with no raid ends after 5 seconds without fighting;** enemies
  that chased the player's units stay where they stopped until the next
  visit, when they're back where the save has them (as in the original).

## 15 October 2026: what farms and ranches show

- **Only buildings laid out like a farm or a ranch** pick their picture by
  what's going on. The original does it for every ranch, but the Training
  Stables' picture is a long animation of its own (318 pictures), and
  stopping it on one would show nonsense; it plays as it is.
- **A farm with nobody named inside** (an old save) shows the man at work.

## 15 October 2026: wild animals

- **Caught animals walk in from the wild.** The original's paths go
  anywhere but through buildings, so an animal caught out in the wild walks
  to its ranch; the player's own units still go only on their land, as
  decided when units first walked here.
- **A wild animal's card says how it's caught** ("bring one of your units
  near"); the original said nothing.
- **Tapping a wild animal with a unit selected** sends the unit beside it
  (as near as it can get on the player's land), so it catches it; the
  original sent it to the animal's own tile.
- **The server starts the day's animal count again each day.** It never
  did, so a town got its animals once and never again.
- **"Captured!" is a little bigger** than the original's, to be read on the
  map at our zoom (64 pixels wide).
- **The browser tests start each town with its wild animals** in the
  corner, as with trees and rocks, so none walk about in a test's way.

## 15 October 2026: trees and rocks grow back

- **As the original, quirks too:** the fourth kind of stone and of gold
  rock isn't counted, so a town with many of them still gets more; a clump
  near a block's edge can spill onto land not bought yet.
- **Towns played only in the new client get their forest on the next
  open,** about 270 trees and a few dozen rocks for a new town, all at
  once, as the Flash client did on a town's first opening.
- **The browser tests start each town with enough trees and rocks,** in
  the wild corners at the top, so none grow where a test taps; one test
  (`nature.mjs`) lets them grow.

## 15 October 2026: the rules the original plays by

The parity check found rules the new client got wrong; these are fixed.
Calls made on the way:

- **Your calls:** the troll town and the market come into Beta 1; the
  Daily News window stays out (it showed Social Point's news and offers).
- **No welcome-back chest.** The Flash client has one, but it is switched
  off inside the game as it was built, by a setting nothing turns on, so
  players never saw it. The new client had offered it, giving prizes the
  game didn't: removed. (The server still knows the chest's command.) *Reversed 15 October 2026:* our classic game has it switched on, so
  the owner chose to keep it in both (above).
- **No skipping goals for cash,** for the same reason: the original's Pay
  button was switched off.
- **The Sacrifice Altar lets nobody in** from the new client for now,
  rather than taking a villager in to work it as a mine. It stays a
  classic-game building until its window is built.
- **A ranch's used-up animal** shows as "−1 Sheep" rising with the
  harvest, until the game's flying-sheep animation is exported.
- **Visits count for the goals back home** through the browser tab's own
  storage, since a visit is a page of its own here; it resets when the tab
  closes, much as the original's counts reset when the game reloaded.
- **Messages go below the top bar while visiting** on a computer, so they
  don't cover the neighbour's name and the help rays.
- **Villagers by town hall,** calls on the way: a tree tapped when the
  villager's line is full is selected, as in the original, and a message
  says how many it has lined up (the original said nothing); the selected
  villager's card says how many it can line up (the original showed it only
  in the barracks' unit details); a villager whose next tree another
  villager finished while it walked goes on to the one after, rather than
  standing still; tapping the tree a villager is already at doesn't start
  its work over; if a town somehow has two town halls, the better counts.
- **Kept as they were, written down now:** a farm harvested without enough
  wood is kept and says so (the original destroyed it); the bonus for extra
  workers uses the workers inside now (the original took the count at a
  building's first collect after the game loaded, and kept it until a
  reload, a quirk not copied).

## 15 October 2026: Beta 2, defending the town (raids)

- **Raiders pay what they showed.** The original showed 5 gold and some
  experience for each raider killed at home, but never told the server,
  so it was lost on the next visit. Now the server pays it when it hears
  the `kill` (the Flash client sends it too, so both clients get it), up
  to 300 raiders a day so it can't be farmed without end.
- **Building waits while raiders are in town.** The original let the
  player keep building during a raid; here the town becomes a
  battlefield until it's over. The stampede and the army never retreat
  (as in the original), so they have to be beaten.
- **Bandits appear when they attack.** In the original they stood at the
  map's edge from the moment the town opened, fighting anything that
  came within reach, and set off after 7 minutes; here they arrive at the
  edge then. They're rarely seen out there either way.
- **Kept from the original:** the village siege (levels 25 to 29) comes
  in the player's own race (humans besiege a human town); the stampede
  and the army never retreat; nothing about raids or burning is saved.
- **Retreating raiders leave from beside their edge tile,** not only
  from the exact tile, so they don't queue up there one by one.
- **Select all leaves villagers out** (they have an attack, but they're
  workers, and they should be able to repair).
- **No clickable gold and experience tokens:** what a raider pays rises
  from it and is counted at once.

## 15 October 2026: Beta 2, special moves

- **Each move is one of a few kinds** (a volley, a storm of hits, a
  whirlwind, a blast, a line, a hit, healing, eggs and minions,
  swallowing, freezing, poison, growing, a war cry, the three LIMITs),
  with its own numbers from our notes on the original
  (`rules/specials-table.json`). Most moves fit one exactly; some were
  simplified to the nearest kind: a move that hits and also burns or
  freezes keeps the hit, a burn ticks every 3 seconds like poison, a
  square area is a circle of the same reach, a volley at several targets
  goes at one, and moves that repeat "N times per loop" are timed by our
  best reading of the animation. The 15 rarest buttons (shape-shifting,
  shields, levitation, ghost copies, invisibility and the like) don't
  show yet.
- **The moves show the unit's own special animation.** The particles some
  moves add on top (fireballs, rays) aren't drawn yet; shots and beams use
  the game's projectiles.
- **Minions and area moves follow the caster's side.** In the original,
  minions always joined the player and units' area moves only ever hit
  the computer's side, which only went wrong when an enemy used them;
  here an enemy's minions fight for the enemy.
- **Enemy heroes use their moves too** (the ones that come by
  themselves); buttons are the player's alone, as in the original.
- **The buttons are a bar at the bottom** for the one special unit
  selected, with the seconds left on each, instead of the original's
  portrait panel.

## 15 October 2026: Beta 2, spells

Where the original had a bug, the spell does what it was plainly meant to:

- **Fire Havoc falls where the marker is.** The original's random square
  sat two tiles up and left of the marker (it took half the area off
  twice), and its aimed fireballs looked a tile off too.
- **Ether Shield covers the marker's square at every rank.** The original
  read the wrong area, so rank 1 covered 7 x 7, rank 2 covered 9 x 9 and
  rank 3 covered nothing at all.
- **2x Range works on units, with its timer.** The original tried towers
  too, stopped with an error at the first one, and left the units before
  it with doubled range for good.
- **Summoned units' life is their own.** The original wrote the spell's
  life into the item's shared data, which would also have changed your
  own Bahamut dragons of that kind.

And where it wasn't a bug, the original stands:

- **Poison doesn't spread,** as in the original (its spreading code never
  worked, so players never saw it), though the code meant it to at ranks
  2 and 3.
- **A freeze or knock-down lasts until the later of the two ends;** the
  original freed a unit when the first one ended. The original's 10-point
  hit when a freeze ended on a tile your unit shared is left out.
- **No "spell cast" banner:** the game's banner has one spell's name
  painted into it ("Age of Colossus"), so it can't show the others. The
  spell's name and its mana float up from the tile instead, as they also
  do in the original.
- **The spell book's spells are in one row** (all you know, up to 15)
  instead of the original's fan of three with arrows; it's quicker, and
  fits a phone.
- **Extras:** Escape cancels aiming; on a touch screen the first tap shows
  the marker and a second casts (the original needed a mouse); the
  Academy's window shows how many casts are left to the next rank.
- **The island's ground no longer shows a thin blue line** where its
  blocks meet: each block is drawn a few pixels bigger from its middle.

## 15 October 2026: the selected unit's pointers

- **On a computer, the original's pointers:** with a unit selected, the
  mouse pointer becomes the game's axe over a tree, pickaxe over a rock,
  and red arrow over a building it can go into, as in the Flash client.
- **On a phone (your pick):** there's no pointer, so the same picture pops
  up for a second over the tree, rock or building the unit was sent to.
  The other idea, an axe over every tree as soon as a villager is
  selected, would clutter a big town.

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
- **Visiting shows your own numbers** in the top bar, with "Visiting
  <name>" beside them. *Corrected 15 October 2026:* this said the Flash
  client did the same; it didn't. It showed the neighbour's name, level and
  resources. To be fixed (PARITY.md).
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
