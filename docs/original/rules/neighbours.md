# Neighbours and messages

How the original Flash client (the copy in `decompiled/`, version 0.9.26b)
handles neighbours: the friends bar along the bottom, the little menu on a
neighbour, visiting their town and helping it, the request that greets a
visitor, the donkey carts that bring help home, friends' help asked for
elsewhere (hurry, the dragon nest, potions), gifts, the social buildings
that take friends as staff, Arthur, and the windows that open by themselves
when the game starts, ending with the server's message. Each rule says what
the original does, in our words, then how the new client compares. Our
notes, not Social Point's code.

**What was read.** Read through: `managers/NeighbourManager`,
`GUI/FriendsWindow`, `GUI/FriendButton`, `popups/PopOverVisit`,
`popups/AssistPopup`, `core/FauxBar2`, `popups/infoFriendAssistPopup`,
`battle/IACartAlly`, `popups/PopupNeighbors`, `popups/PopupSocialBuilding`,
`popups/PopupRecruitment`, `popups/PopupRecruitmentPopulation`,
`popups/PopupSocialFeeds`, `popups/PopupHireFriendsGeneric`,
`core/FotoNeighbour`, `core/Token` (how pickups are collected), and
`GameStatic.isFriendAsistable`. Read in the parts that matter here:
`core/Base` (loading the neighbours, the 24-hour rule, map switching,
`UpdateGame3`, the timed neighbours window, `countAllBuildings` with its
free social helpers, `IsBeingBuilt`, gifts loading and placing),
`managers/PopupManager` (the start-up sequence, `neighborPopup`,
`neighborAssist`), `GUI/GuiManager` (visiting mode, the help rays, going
home, the blocked tools), `core/isoengine/IsoInteractiveElement` (the help
tap and the hover cursor), `core/isoengine/IsoElement` (friends' hurry
pictures, the allied market's collect), `core/isoengine/IsoEngine` (the
harbour and zeppelin staff), `GUI/RecuadroInfo` (which button opens which
social window, the card while visiting), `managers/MissionsManager` (the
neighbour goals), `popups/PopupDragons` (the friends' help part),
`popups/PopupGraveyard` (the potions ask), `popups/PopupHurryup` (Ask
friends), `core/Config` and the config's `globals`, `neighbor_assists` and
`social_items`. `core/MapInitializer` was read for this: it has nothing on
neighbours beyond calling `countAllBuildings` (the free helpers) at home.
**Skimmed:** the potion offer (`managers/offers/KompuManager`, read only
for when it opens), the tutorial's own after-windows, the Round Table's and
recruitment camp's drawing and animation, the social windows' photo layout,
and the iPhone and Facebook parts (invites, feeds, "like"), which our game
doesn't need. Social Point's server was never seen, so what it paid is
known only from what the client shows.

Our side, read: `client/src/rules/neighbours.ts`, `client/src/visit.ts`,
`client/src/ui/neighbours.ts`, `client/src/main.ts`, `client/src/editor.ts`
(carts, the server's message), `client/src/ui/hud.ts` (the rays),
`client/src/rules/goals.ts`, `client/src/view/townView.ts` (social
buildings), `client/src/rules/dock.ts`, and the server's `assists.py`,
`helps.py`, `social.py`, `gifts.py`, `friends.py`, `sessions.py`
(`neighbors`) and `get_player_info.py`.

Our classic game serves a copy of the client with the welcome-back bonus
switched on (`tools/patch_client.py`); nothing here is touched by that.
Words used below: "at home" means the player's own town in normal play;
"a session" is one load of the game page (the Flash client keeps some
things only until the page is reloaded).

## The neighbours bar

- The list comes once, with the first `get_player_info` of the page
  (`neighbors`). Each neighbour keeps its id, name, experience, level and
  world, and a picture from the page's Facebook friends list (none on our
  server). The list is not read again on later map loads, so it stays as
  it was when the page opened. *Ours: same idea: the list comes with the
  town (`client/src/main.ts`); each page load reads it again, as each visit
  is a page here.*
- A neighbour counts as "can be helped" when the save's
  `neighborAssists` (keyed "u" + id, or the bare id) is more than 24
  hours (86,400 seconds) older than the server's time at loading. Exactly
  24 hours is still too soon. *Ours: same rule (`helpedLately`,
  `client/src/rules/neighbours.ts`), checked when the visit opens; at
  exactly 24 hours ours already allows it, a one-second difference that
  doesn't matter (the server checks too).*
- A neighbour called "Best Empire" doesn't count as a real neighbour (for
  land bought with gold). *Ours: same (`client/src/main.ts`, the land
  count).*
- The bar shows the neighbours sorted by experience, smallest first, then
  Arthur, then an empty "add" slot at the end. With fewer than six cards
  in all, the empty slot is dropped and empty slots are put at the front
  instead, so the neighbours sit on the right. *Ours: different: a
  window with one row each, friends first, then the most recently seen
  players, then Arthur; no sort by experience, no add slot, a link to the
  Friends page instead (`client/src/ui/neighbours.ts`). The window itself
  is the owner's choice of layout.*
- Six cards show at a time. It opens on the last six (Arthur and the add
  slot in view). Arrows move one card or six. Quirk: the scroll position
  starts three places away from what is shown (it is worked out from the
  neighbour count, not the bar's length), so the first press of a left
  arrow jumps further than one card. *Ours: different: a scrolling list
  (`client/src/ui/neighbours.ts`).*
- Each card: the picture, the name, "XP" with the neighbour's experience,
  and a star with the level. A help mark shows on a neighbour who can be
  helped and wasn't helped this session. *Ours: different: picture (an
  initial on a colour; Arthur's king), name and level; no experience and
  no help mark (`client/src/ui/neighbours.ts`). PARITY.md lists it.*
- Pressing a card does something only at home and outside the tutorial.
  The empty slot opens the page's invite (Facebook's). *Ours: the
  Neighbours window is only in the home town's menus; the add slot is
  missing (the Friends page link stands in).*
- A world mark on the card is switched on after visiting a neighbour who
  has a world id, but nothing is wired to it; it does nothing. *Ours:
  missing, nothing lost.*
- A switch for made-up neighbours (`Config.ENABLE_FAKE_FRIENDS`) is off,
  and nothing turns it on; its A/B test and `set_fake_neighbors` never
  run. *Ours: same (not built).*

## The menu on a neighbour

- Pressing a card opens a small menu where the pointer is, with Visit,
  Attack and Send gift. It closes as soon as the pointer leaves it.
  *Ours: different: each row has Visit only
  (`client/src/ui/neighbours.ts`).*
- Visit opens the neighbour's first town (map "0"), whatever town the
  player is in. It hides the card's help mark at once, before any help is
  given. *Ours: same town (the server's `get_neighbor_info` defaults to
  0; `client/src/net/server.ts` sends no map).*
- Attack starts an attack on the neighbour's first town, as a human town.
  Not offered for Arthur. *Ours: missing (battles against players are for
  later).*
- Send gift opens the page's gift page (`gotoGifts`). On our classic page
  that is our gifts window (`templates/_gifts.html`). *Ours: missing in
  the new client; the classic page has it.*

## Visiting a neighbour

- The visit loads the neighbour's town with the visitor's commands sent
  first. Visiting the same neighbour and town already shown does nothing.
  *Ours: a visit is a page of its own (`/client.html?visit=`), so the
  commands go before the page changes (`client/src/visit.ts`).*
- While visiting, the background is the neighbour's town colour (their
  skin). *Ours: same (`client/src/main.ts`).*
- The music stays the player's: the troll tune if the player left from
  their troll town, else the town tune. *Ours: different: the visited
  town's race picks it (`client/src/main.ts`, `Sound`), so a visit from
  the troll town plays the human tune.*
- The top bar shows the neighbour: town name, player name, level (the
  visited town's own level), an empty experience bar that can't be
  pressed, and their gold, cash, wood, stone and food. A Back home button
  shows. The world button, the countdowns and the side icons are hidden.
  *Ours: same in substance, with "Visiting <name>" (`client/src/ui/hud.ts`;
  PARITY.md marks it done).*
- Shop, games, gifts, world, the glove and the bulldozer stop working.
  The friends bar stays, but its cards do nothing away from home, so
  there's no hopping from neighbour to neighbour without going home.
  *Ours: same in effect: a visited town has no menus, only Back home.*
- Dragging the map works; there is no tile hover or square selection.
  Pressing their buildings selects them and shows their card, with its
  buttons covered so they can't be used. *Ours: different: no card on a
  visit; a tap only helps (`client/src/visit.ts`).*
- Back home loads the town the player left, with their own music.
  *Ours: not checked which town Back home opens.*

## Helping on a visit

- What can be helped: mills, farms, mines (not the Treasure Mine 218 or
  the Sacrifice Altar 225), ranches (not the Nursery 226 or the Training
  Stables 227), the collect buildings (the Temple, the Restaurant and the
  Bakery), and wonders that give no room for people. Quirk: its "is this a
  building" check is written so it never fails, but units are kept out
  anyway by their kinds. *Ours: same (`canBeHelped`,
  `client/src/rules/neighbours.ts`). CLIENT.md's list says "the bakery"
  only: the Temple and the Restaurant count too.*
- Hovering a building that can be helped shows the help pointer.
  *Ours: missing (no hover on a touch screen; not needed for the rules).*
- A tap on a building that can be helped, not yet helped this visit, of a
  neighbour not yet helped this session: if they can be helped today and
  fewer than 5 buildings were helped, it is marked, stars stay on it,
  10 gold and 3 XP fly up, and the five rays at the top lose one. Else a
  "no more helps" alert, every such tap. *Ours: same help and numbers;
  different when out of helps: helped lately, a tap does nothing (the
  opening message said so); 5 used, a line in the message bar
  (`client/src/visit.ts`).*
- A building already helped on this visit: tapping it again just selects
  it. *Ours: different: a line says it was helped already
  (`client/src/rules/neighbours.ts`, `Helping.help`).*
- The 10 gold and 3 XP don't reach the visitor's own numbers on screen:
  pickups only add at home. The server pays when the help arrives, and the
  visitor sees it on going home. *Ours: same: the numbers rise from the
  building, the top bar keeps the neighbour's (`client/src/visit.ts`).*
- On leaving the visit, the buildings helped go as one command,
  `assist_neighbor_new` (neighbour, 0, the list of [x, y, id] as JSON),
  sent at once. Nothing is sent when nothing was helped. *Ours: same
  (`Helping.finish`), sent before Back home moves on, and on the page
  hiding.*
- Quirk: leaving marks the neighbour as helped for the rest of the
  session even when nothing was helped, so a second visit the same session
  can't help at all. *Ours: different: a visit without help leaves
  nothing behind; the next visit can still help (the server decides by
  `neighborAssists`).*
- The rays show 5 minus the helps used; none when the neighbour can't be
  helped today or was helped this session. *Ours: same
  (`client/src/ui/hud.ts`, `helpsLeft`).*
- The server's pay (on our server, `assists.help_buildings`): 10 gold and
  3 XP per building, at most 5, into the visitor's first town; the
  neighbour's `neighborAssists` time set; the helped buildings put in the
  neighbour's first town as `receivedAssists` under the visitor's id
  (replacing any earlier list from the same visitor). *Ours: the same
  server for both clients.*

## The request on arriving

- On a visit's first load, if the neighbour can be helped today and wasn't
  helped this session, a window asks for help with one of five tasks from
  the config's `neighbor_assists`, picked at random (each equally likely).
  It has OK and a close button. Arthur never asks (his card has no help
  flag). *Ours: missing (`client/src/visit.ts` doesn't offer it).*
- OK closes it and runs a short bar, 10 steps 50 ms apart (half a second),
  then adds the config's `ASSIST_REWARD_GOLD` (10) and `ASSIST_REWARD_XP`
  (3) and sends `assist_neighbor` (neighbour, the task's number, town) at
  once. The config's own rewards on each task (50 coins, 15 XP) are not
  used. *Ours: missing.*
- Closing it does nothing; the building helps can still be given.
  *Ours: missing.*
- Accepting doesn't use up the building helps on the client: the visitor
  can still help 5 buildings, which go as `assist_neighbor_new` on
  leaving. Our server takes the first as that day's help and turns the
  second away, so the building helps are lost (see
  `docs/original/index/core.md`, surprise 2). *Ours: not offered, so not
  hit.*
- Two unused numbers sit in `Config`: 25 gold and 15 XP for entering.
  Nothing reads them. *Ours: same (not used).*

## Donkey carts: help arriving

- At home, and only in a human town, every load shows one Ally Cart (unit
  506) for each neighbour in the town's `receivedAssists`, all at once.
  Each starts on the middle tile of the map (50, 50) or a random free tile
  next to it. *Ours: different: one cart at a time, the next after the
  last is gone (`welcomeCarts`, `client/src/editor.ts`); no race check,
  but only the first town receives help, so the same in practice.
  CLIENT.md says the cart stands "by the town hall": in both clients it
  starts at the map's middle (50, 50). CLIENT.md's "one after another" is
  right about ours; it is the comment on `welcomeCarts` that calls that
  the Flash client's way, and it isn't.*
- Over each cart floats a bubble with the neighbour's name, picture, a
  "wants to help" line, Accept and a close button. *Ours: different: a
  bar at the bottom with Let it in and No thanks (a recorded decision);
  tapping a waiting cart asks again.*
- Both buttons send `clean_received_assists` (neighbour, town). Close
  removes the cart. Accept puts the neighbour's picture over the cart and
  starts its round. *Ours: same commands (`cartMet`).*
- Carts not answered when the player leaves home are removed without a
  command, so they come back on the next load. *Ours: same (nothing sent
  until answered).*
- The round keeps the buildings in the order the server gave, dropping
  any whose tile no longer holds a building of that id that can still be
  helped. *Ours: same (`cartRound`, `client/src/editor.ts`).*
- For each building, the cart drives to a random free tile within 8 of
  it, then throws a crate in an arc (half a second up, half down). When
  it lands: `assist_receive` (town, building id) is sent at once, and a
  pickup of a quarter of the building's harvest (rounded down) in its
  resource drops beside it, with a pickup of 10 XP (`Config`
  `FRIENDS_ASSIST_DIVISOR`, `FRIENDS_ASSIST_EXPERIENCE`), and stars.
  *Ours: same command and amounts (`deliver`); different look: the cart
  walks to a tile beside the building and the numbers rise, no crate.*
- The pickups wait on the ground for a tap before they count (unless 6
  or more pickups are already lying about, when they collect themselves).
  Leaving home clears them unpicked; the server had paid already, so the
  next load shows them. *Ours: different: added to the town at once
  (`deliver`).*
- When the round is done, the cart says a short farewell ("Glad to help")
  and fades out over 1.5 seconds. *Ours: different: it is removed
  without a word.*
- Quirk, as read (not tried): if a cart stops short of its stop, it
  throws from where it stands, and that check runs every frame until the
  first crate lands, so it could throw many crates for one building,
  each sending `assist_receive`, then skip the rest of its round. Our
  server pays only help still waiting, so a repeat can at most deliver
  another waiting building of the same id early. *Ours: not copied.*
- What the server does (ours, `assists.py`): `clean_received_assists`
  moves that helper's list to "on the way"; each `assist_receive` pays
  the first waiting entry with that building id, a quarter of its
  `collect` in its resource (gold when it has none of the four) and 10
  XP. *Ours: the same server; CLIENT.md's note on this fix is right.*

## Friends' help asked for elsewhere

- Hurry: the hurry window has Ask friends, which opens the page's ask
  window for that building (`showPopupSEHelpCollect`). *Ours: missing
  (PARITY.md lists it).*
- Friends who answered show over the building as their pictures (the
  building's `hc`, those not yet used), stacked, the top one showing.
  Only at home. Tapping the building while any wait uses one: an hour off
  its wait (`COLLECT_HELP_SECONDS`, 3,600), `accept_collect_help` (x, y,
  town, id, friend), the next picture shows. These pictures go when the
  building is ready. *Ours: missing: the new client ignores `hc`, so the
  hours wait in the save for the classic game.*
- The dragon nest: Hire friends asks all friends through the page. Each
  friend in `dragonSocialHelp` counts for 2 steps, taken when the nest's
  window opens (a list of their pictures first, then the steps, never past
  the dragon's 10), then `finish_dragon_help` with the list. *Ours:
  missing (the nest is not built yet).*
- The graveyard has an ask-friends-for-potions handler, but no button is
  wired to it: it never runs. *Ours: same (none).*

## Social buildings

- Which: every building in the config's `social_items` (31 of them:
  mills, mines, markets, churches, workshops, the harbours and zeppelins,
  the Summit 234, the Allied Markets 266 and 352, the recruitment camp
  387, the Round Table 389, the Great Church 470). Each lists its places
  (one name per place) and `worker_cost`, the cash for a hired helper.
  *Ours: the list is read (`client/src/rules/config.ts`, `social`).*
- A social building with a staff list (`si`) is "waiting for staff". It
  is drawn with its second picture while waiting, and a tap on it at home
  opens the staff window (but the Summit, the Allied Markets, the
  recruitment camp, the Round Table and the Great Church open their own
  windows from their card). *Ours: different: always drawn open
  (`client/src/view/townView.ts`), no window. Our server drops `si` from
  all but six of them on loading (`social.py`), so the plain ones are open
  in both clients on our game.*
- The staff window: one place per name. An empty place offers a friend
  (the page's ask window) and, when `worker_cost` is above 0, a cash
  button. Buying spends the cash and sends `buy_si_help` (x, y, town,
  id); the place shows a villager. A friend's place shows their first
  name and picture. *Ours: missing.*
- When all places are filled, the button opens it: `finish_si`, the staff
  list removed, and a "congratulations" window (a Facebook share).
  *Ours: missing (not needed on our server for the plain ones).*
- The Summit: when full, it brings allied troops, but only with room for
  9 more people (else a "population full" alert and nothing sent). Then
  `finish_si` and its staff starts again empty. *Ours: missing.*
- The Allied Markets: the player first picks a resource (wood, stone,
  food or gold) with `set_resource_allies`. The window shows 125 x (staff
  + 1) and the time left. Collecting pays that much of the picked
  resource, empties the staff, sends `finish_si` and sets the resource
  back to none. *Ours: missing.*
- The recruitment camp: 3 places, friends only (no cash). Its window
  cycles through five rewards (the config's `NEWFRIENDS_REWARD_ID_UNIT`:
  1 Elephant Rider, 2 Vikings, 2 Monks, 1 Thor, 1 Mobile Tower). When
  full, the shown reward's units appear beside it, bought free, and
  `finish_si` goes; the staff starts again. *Ours: missing.*
- The Great Church (the wonder of people): 20 places in 5 rounds of 4.
  A full round's button adds 10 room for people (`POPULATION_INCREASE`),
  up to 5 times (+50), with `increase_population`. Its window's words are
  written in the client in English. *Ours: the room is counted
  (`client/src/rules/training.ts`); the window is missing.*
- The Round Table: the player posts to friends one by one
  (`assist_send_feed`), at most 60 (`MAX_FEEDS_ROUND_TABLE`). When its
  clock is done: 4 answers pay 1,000 gold, 6 add 100 XP, 8 add a hero
  (Xena, Arthur, Ranger or Merlin, at random) to storage; then `finish_si`
  with what was paid and `collect_new`. Quirk: its 60-post check is
  written so it stops a post even to a friend already posted to. *Ours:
  missing.*
- Free helpers on opening (changes the save): at every home load, a
  social building with a staff list and a `worker_cost` above 0 gets one
  helper free (`buy_si_help` with a fifth argument, 1) when its list is
  empty and it has 3 places or more, or when it has exactly one and 7
  places or more. One per load, so up to two over two loads. On our
  server that means the Summit and the Allied Markets, again after each
  time their staff empties. As far as read, our server writes no staff
  list when one is built: the list appears with the first helper, the
  first `finish_si` or a friend's offer (`helps.py`), so a new Summit or
  Allied Market gets its free helpers only from then on. *Ours: the same
  since "Town rules from the map of the original", `client/src/rules/social.ts`.*
- The harbour and the zeppelin tower are staffed for free on opening,
  with 20 `buy_si_help` and a `finish_si`. *Ours: built
  (`client/src/rules/dock.ts`); not re-checked here.*

## Gifts

- Gifts waiting come in the save (`privateState.gifts`, id to count) and
  go into storage ahead of stored things, each marked as a gift. Placing a
  gift gives its experience (the Level-Up Statue: exactly what's missing
  for the next level) and sends `place_gift`. *Ours: same
  (`client/src/rules/storage.ts`; checked in the storage notes, not
  again here).*
- Sending gifts is not in the game: Send gift and the empty gift box call
  the page (`gotoGifts`), and with the page's `showInitialGift` flag the
  game calls `gotoInitialGifts` once the town is up. *Ours: the classic
  page passes the flag and opens our gifts window; the new client has no
  way to it yet (CLIENT.md, "Not yet").*
- A window to pick friends to send a special gift to
  (`PopupInviteFriends`) exists, but nothing in the game opens it.
  *Ours: same (none).*

## Asking for more neighbours

- After the tutorial, if this browser hasn't seen it today (the day of
  the month, kept in the Flash cookie), a "need allies?" window opens 5
  minutes into the session (`TIMER_NEIGHBOUR`, 300,000 ms), only at home
  and not during a mini-game. Its yes opens the page's invite. The day is
  recorded even if it couldn't open (away from home). Quirk: only the day
  of the month is kept, so a visit on the same day a month later skips
  it. *Ours: missing (an advert for inviting; the Friends page does the
  job).*
- The same window opens when land paid in gold needs more real
  neighbours. *Ours: different: `client/src/rules/land.ts` says how many
  are needed.*
- An "invite friends" icon among the side icons is declared but never
  made. *Ours: same (none).*

## Arthur

- The client adds him, not the server: after the sorted neighbours, named
  Arthur (Guinevere for players the page says are women), with the king's
  picture (the princess's for women), level round(player's level x 1.2),
  no higher than the levels table allows, and that level's experience.
  Worked out once, when the bar is made at the page's opening. *Ours:
  same (`arthur`, `client/src/rules/neighbours.ts`); always Arthur and the
  king, as our pages always say male (a recorded decision).*
- Pressing him picks his town by the player's level at that moment: up
  to 10, 100000030; up to 20, 100000031; above, 100000032. *Ours: same,
  by the level when the page opened.*
- His card never has the help mark and his visit never asks for help on
  arrival. But his buildings can be helped, up to 5, once each session
  (his card has no daily flag at all). *Ours: different: once a day, by
  the save's `neighborAssists`, as our server allows anyway
  (`assists.help_buildings`).*
- His menu has Visit and Send gift, no Attack. *Ours: Visit only.*

## Goals about neighbours

- "Visit Arthur" (goal 44) is done when the last neighbour visited this
  session is one of Arthur's three towns; helping isn't needed. *Ours:
  same (`client/src/rules/goals.ts`, kept in the tab's storage;
  `docs/original/rules/progress.md`).*
- Helping 5 neighbours' buildings counts only the helps given while that
  goal is open. *Ours: different, as `progress.md` says: counted from the
  tab's start.*

## The windows at start, and the server's message

- The start-up windows run at every map load outside the tutorial (in the
  tutorial none of them run). They come one at a time: each window, when
  closed, calls for the next. The order: (0) the daily bonus, from level
  5, at home, human towns only, opening by itself; (1) at home from level
  5: half the time the potion offer if one is running, else the news, once
  a session; (2) a tournament invitation from the page, first load only,
  which ends the sequence; (3) darts, first load only, at home; (4) the
  heavy siege, first load only (switched off); (5) a quest's story held
  back from loading; (6) no town hall (first load at home, or an attack);
  (7) the iPhone notice (always skipped); (8) at home in a human town:
  the harbour and zeppelin checks, and on the first day, below level 15,
  with the princess still a prisoner and no allies, the princess's
  helpers; no window, it goes straight on to (9) the server's message.
  *Ours: different: no sequence; the daily bonus waits on its button (a
  recorded decision). The server's message goes up in the bar first, then
  Arthur's lessons or the carts after its OK. The harbour and zeppelin
  lines don't come first, as an earlier reading said: they are given
  once the town's defence code has loaded (`defend`, `client/src/main.ts`),
  so their line shows at the top a moment after the message's bar is up.
  Darts, news and the potion offer are not built (news left out by the
  owner).*
- Quirk: the potion offer's window doesn't call for the next one, so on
  a load where it shows, everything after it (darts, the harbour checks,
  the server's message) waits for the next load. Likewise after the
  tournament invitation. *Ours: not copied.*
- The server's message (`privateState.message`): when it isn't empty, at
  home, an alert with OK shows it, last of the start-up windows. The
  client forgets it at once; closing the alert sends `clear_message`.
  Not shown while visiting, nor during the tutorial. *Ours: different:
  shown in the bar with OK before the carts and the lessons (a recorded
  decision, 15 October 2026); OK sends `clear_message`
  (`showServerMessage`, `client/src/editor.ts`). CLIENT.md's
  "as the Flash client does" is right about OK and the command, not the
  moment.*
- The carts are not part of the sequence: they appear on the map at once,
  under whatever window opens. *Ours: different: they wait for the
  message's OK.*
- After the tutorial ends, its own short sequence offers the choice of a
  dragon (`POPUP_CHOOSE_YOUR_DRAGON`, on). Skimmed. *Ours: not checked
  (the lessons are in the classic game).*

## Differences

Most serious first.

**Changes the save**

1. **Free social helpers on opening.** The original hires up to two
   helpers free at the Summit and the Allied Markets (`buy_si_help`, free)
   as the town loads, once the save holds a staff list for them; ours
   sends nothing (`client/src/main.ts` has no such step). (checked twice)
   *Fixed since "Town rules from the map of the original".*

**Looks or feels different**

2. **Carts come one at a time** in ours, all at once in the original
   (`welcomeCarts`, `client/src/editor.ts`). (checked twice)
3. **The carts' shares are added at once** in ours; the original drops
   pickups that wait for a tap. Same totals (`deliver`,
   `client/src/rules/neighbours.ts`). (checked twice)
4. **The cart's look**: a crate thrown at each building, the helper's
   picture over the cart, a farewell line and a fade in the original; a
   walk and rising numbers in ours. (checked twice)
5. **The server's message and the carts wait for each other** in ours,
   before Arthur's lessons; in the original the message is the last
   start-up window and the carts are on the map at once (decided).
   (checked twice)
6. **No start-up sequence** in ours: the daily bonus waits on its button
   (decided); darts and the potion offer don't exist yet. The original
   opens the harbour and zeppelin before the server's message; ours puts
   the message up first and their line a moment later. (checked twice)
7. **Neighbours list**: not sorted by experience, no experience shown, no
   help mark, no add slot (`client/src/ui/neighbours.ts`). (checked twice)
8. **A visit without help** blocks helping that neighbour for the rest of
   the session in the original; ours doesn't. (checked twice)
9. **Arthur** can be helped once a session in the original client, once a
   day in ours (our server allows once a day either way). (checked twice)
10. **Tapping when out of helps**: an alert each time in the original;
    silence (helped lately) or a line (5 used) in ours; ours also says a
    building was helped already, where the original just selects it.
    (checked twice)
11. **No card for their buildings** on a visit in ours. (checked twice)
12. **The music on a visit** follows the visited town in ours, the
    player's town in the original. (checked twice)

**Missing**

13. **The request on arriving** (10 gold, 3 XP, `assist_neighbor`).
    (checked twice)
14. **Social buildings' windows**: staff places, cash helpers, the Summit's
    allies, the Allied Markets, the recruitment camp, the Great Church's
    rounds, the Round Table. (checked twice; the windows' numbers were
    checked, their drawing only skimmed)
15. **Friends' hurry help**: Ask friends, and their pictures over a
    building taking an hour off (`hc`, `accept_collect_help`). (checked
    twice)
16. **The dragon nest's friends' help** (with the nest). (checked twice)
17. **Attack and Send gift** on a neighbour. (checked twice)
18. **The "need allies?" window** five minutes in. (checked twice)
