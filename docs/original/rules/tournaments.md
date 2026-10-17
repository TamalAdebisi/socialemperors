# Tournaments

Read locally on 16 October 2026: every tournament window, card and row,
`SelectionTeamWindow`, `ThumbUnit`, `ThumbSelectedUnit`, `PopupHelp`,
`TournamentManager`, `ServiceManager`, `TournamentIA`, tournament
placement in `MapInitializer`, the spell exclusions in `PopupMagic`,
`IsoEngine.refreshTotalPlayerUnits`, the saved storage/gifts and map
loading in `Base`, the gate and return-home handling in `GuiManager`,
its level in `Config`, and the relevant `MissionsManager` checks.
Review also reread `IA.checkHealerBehaviour`, `ClericEngineerDelegate`,
`IsoUnit.updateAttack`, `IsoFightingElement.recibirVida`,
`AngelicalSuperHealerDelegate`, `LimitDelegate`, the siege predicate,
`ThumbWeeklyTournament`, `ThumbTournament`, and
`TournamentResultTabResults` locally.
Compared with `tournaments.py`, its tests and the existing battle,
storage, friends and command patterns. The decompiled source remains
local and ignored. These notes are in our own words.

## List and help

- The world menu opens tournaments at level 15 with the config switch on.
- Opening reads `get_tournament_info`. An existing tournament goes to its
  waiting room or results/matches window rather than starting another.
- Public types have no weekly interval. Friends' cards use the owner's
  name, room id, type and room reward index. Public reward indices come
  from the server's `tournament_reward_id`, not the client clock.
- Weekly cards are hidden when `full` is 1. Otherwise `open` controls entry
  and `timeLeft` supplies the countdown. Open weekly cards precede the
  others in Flash, then friends and public cards; closed weekly and the
  creation card follow. Flash pages three cards at a time.
- Help includes the names of the config's forbidden units. Its first
  appearance is saved with `set_help_map ["tournamentHelp"]`.

*Built:* list, help, countdown, state handling and original pictures in
`ui/tournaments.ts`, with Everyday/Weekly/Your own buttons and scrolling
cards for the agreed panel. `ui/tournamentResults.ts` shows weekly prize
previews, matches and rankings. These previews give no rewards.
The owner's later interface decision hides classic choices; the original
routes and compatibility with the same saved teams/rooms remain.

## The shared team editor

- The pool includes nonsummoned standing player units, warehoused units,
  town storage and units contained in buildings. Gifts are a separate
  box and are not counted. The picker excludes peasants, cows, sheep,
  horses, settlers, boars and carts, plus tournament-banned ids.
- Add all sources before applying each unit's positive `units_limit`.
  Choices are ordered by attack descending, with remaining counts.
- Twenty places; adding fills the first vacancy, removing returns a
  copy, Reset clears. Save is unavailable with an empty selection unless
  there were no eligible units. Saving does not require twenty units.
- On opening, retain saved units only while eligible copies remain,
  compact them into the places, and immediately save twenty ids with
  zeros. This restoration does not apply the combined complex-unit cap.
- Accepting edits rechecks ownership and per-unit limits, then enforces
  `TOURNAMENT_MAX_NUMBER_COMPLEX_UNITS` across dragons, gods and colossi.
  Save uses `set_attack_team ["tournament", JSON-string]`. Quest mode has
  its own team key and requirements.

*Built:* tournament pool, restoration, edit validation and save, with
five columns for phone targets. Cancel discards an edit. The quest
picker's separate ownership-source gap remains in PARITY.md.

## Entry and services

- Public/friends entry checks ownership, the complex cap, a nonempty
  team and confirmation for a short team. Weekly entry skips that
  card's ownership and complex-cap recheck. The list restores eligible
  copies when opened, but weekly can retain that selection after later
  ownership changes. `ThumbWeeklyTournament` and the manager's join path
  preserve this exception; refreshing balances does not add the public
  ownership check. Weekly checks empty/short teams. A full weekly
  team entering within the last ten minutes gets an ending warning;
  the short-team warning takes precedence, not both. The shared editor
  still applies its own cap; these are distinct checks.
- Join's original payload contains `user_id`, `tournament_type_id`,
  `category`, twenty-id `team`, `tournament_id` (empty for public/weekly)
  and `flashSubResources: 1`. Categories are 1 for levels 15–20, 2 for
  21–25, 3 for 26–30, 4 for 31–40 and 5 above 40.
- The original sends `tournament_substract_resources` (spelling kept)
  with resource, amount, type and private flag before joining, flushed
  before the service. Its refund command is
  `tournament_refund_resources [resource, amount]`. Our server already
  takes/refunds actual fees in its service; bookkeeping commands are
  deliberate no-ops. Refusal refund metadata undoes the old client's
  display subtraction; it is not an extra payment from this server.
- Requests retain the `data` field's 64-character prefix, semicolon and
  JSON, with `user_id` and ordinary authenticated form fields. This
  unsigned client uses 64 zeros, as for the original list service.
  Failed reads must not be mistaken for an empty room. The client checks
  required room/player/match fields and optional winner/ranking fields
  before using the response. Ranking keys must be positive integer ranks;
  each top row and the own-rank row must have valid numeric data. Weekly
  maps contain records with 0/1 open/full flags and finite remaining time;
  reward-map entries are nonnegative integer indexes. Supported
  number-or-string wire fields, nullable dates, empty metadata/maps and
  weekly bots without outgoing matches remain valid. These response
  checks add no ownership or complex-unit cap to the original entry rules.
- A successful join/create returns the full room/list state. Refusals
  distinguish invalid team, too few friends and other unavailability.
  After an ambiguous entry reply, read the existing room rather than
  blindly sending another entry. Another tab may have entered a different
  type or team: display that actual enrollment and its saved balances,
  without crediting the unconfirmed attempt as a confirmed fee spend.
  Refresh authoritative balances after services; they may also have
  advanced another room or paid a prize.

*Built:* original formats in `net/server.ts`, entry checks in
`rules/tournaments.ts`, serialized actions in `ui/tournaments.ts`, and
town refresh/ordinary spending progress in `main.ts`. The server keeps
the existing fee and team rules. There is no dedicated tournament goal
in the shipped 227 missions; tournament wins are not player-attack wins.

## Waiting rooms, leaving and friends

- A room has four seats and a frozen twenty-slot team per entrant.
  Empty seats use the original placeholder, bots their configured
  portraits, real players the site's established initial portraits.
  The list reopens a waiting room, or matches/results if already ready.
- The original minute countdown is a **refresh timer**. It asks
  `get_tournament_info` every sixty seconds and updates seats. It does
  not measure time until bots arrive. Readiness needs both a ready
  date and all configured seats. Start then opens Matches, without
  starting a battle service. Closing preserves enrollment.
- `tournaments.py` groups public entrants by type and level category.
  The fourth entrant starts the room. Its next service sweep fills
  empty public seats after thirty minutes and private seats after a
  day. These bots copy the entrants' teams in turn. Weekly rooms start
  against the three configured bot armies immediately. No precise
  waiting deadline is exposed by the original room response.
- Friends' creation offers public types only. It validates the team
  and short-team warning before choosing a type. The request includes
  `tournament_type_id`, `team`, `usersFriends`, `flashSubResources: 1`.
  The server checks its own neighbour list, not the supplied list:
  at least three real player empires. Following the owner's #95 policy,
  these are eligible other registered accounts' empires in Everybody,
  without an accepted-friendship gate or the former neighbour cap.
  The minimum count, host, room, fee and refund rules are unchanged.
- The waiting private owner gets Cancel and Invite; other entrants
  get Leave. Original Invite called the embedding page's social
  bridge. Here the classic page already substitutes an explanatory
  notice and `/friends` link: neighbours find the room in Your own.
  The new panel keeps that policy; the linked community page is now
  Everybody following #95. No separate invitation record,
  external message or start-up invitation popup is needed.
- Leaving before readiness refunds that entrant; the private owner's
  departure cancels the room and refunds every human. Once ready,
  leaving means abandonment, without refund: unfinished outgoing
  matches become zero-point losses, but others can fight the frozen
  army. A ready host cannot cancel everybody's tournament. A finished
  departure only acknowledges the result.
- A provided leave/cancel room id must match the current enrollment;
  stale requests cannot remove a newer room. Omitting it retains the
  legacy behavior. A lost cancellation reply can be reconciled by
  refreshing; another entrant learns of cancellation the same way,
  and reloads the refunded balance.

*Built:* `ui/tournaments.ts`, with manual Refresh as a convenience,
timers stopped on close and failed refreshes retaining the last room.
Profile replies are tied to the current window, room and latest request;
rendering another view or closing the profile invalidates older reads.
The server's additive stale-id guard is covered in
`tests/test_tournaments.py`.

## Matches and scoring

- Each entrant separately attacks the other three saved armies. These
  are independent directed matches, not elimination rounds. Defenders
  need not be online. There is no loss of units from home, storage or
  the saved team, and no attack-player reward or casualty command.
- Owner-requested interface difference from #94: tournament battles use
  the shared `GameLoop`, advancing while a tab is hidden and retaining
  explicit Pause. The original tournament army, score and service rules
  are unchanged.
- The type supplies the arena map id. Arena fixtures are neutral and
  the whole map traversable. Each army forms in two columns of ten:
  player x10/14, defender x90/86, rows y59 down to 41 in steps of two.
  Zero slots do not leave gaps; nearest-free placement handles overlap.
  Starting walks the player ten tiles right, the defender twenty left.
- Start is explicit after the artwork loads. A fresh room read must
  still contain this player's unfinished match before sending
  `start_tournament_match` with `victim_id` and `tournament_id`. The legacy
  service can return OK for stale requests, so OK alone is not proof
  that the match is available.
- Defenders form at their slowest member's speed, then wait. Weekly
  defenders charge after ten seconds. Public defenders have no timed
  charge; their inherited defensive behavior can still react to an
  approaching foe before taking damage. Marching speeds return to
  normal on the first hit, not merely when the weekly charge begins.
  Target order uses the original army's initial health order: first
  within range plus two, else the initially weakest; an existing valid
  target is retained. This is not a continuous weakest-health sort.
- Healers on both sides can retain a whole patient in tournaments.
  The four original defender healers (502, 590, 866, 886) follow a friendly
  nonhealer initially. The separate damage-triggered choice may switch
  them to a hurt friendly unit with lower absolute health, including
  another healer; the initial fallback's exclusion does not apply there.
  Engineer 570 is deliberately outside that collective group:
  inherited healer behavior repairs injured friendly siege units and
  clears hostile targets. The new client's repeated collective orders
  must not overwrite this separate repair target between ordinary AI
  updates.
- Original healing caps actual health but sends the attempted amount
  to the unit delegate; healing LIMIT therefore grows even when the
  patient is whole, subject to its usual cadence. The shared callback
  uses the positive rounded attempt, not only the health restored.
  A zero-effect heal omits the visual `+0` event, while retaining the
  callback, patient and original LIMIT behavior.
- Every ten seconds after forming, original living units outside the
  middle sixty-by-sixty area walk back to its boundary. Both armies
  receive this boundary correction.
- The original armies alone supply life bars, counts and completion.
  Summoned fighters can fight, but do not enter those tracked lists.
  Crack (7) and Black Hole (16) remain visible but disabled; other
  learnt spells use ordinary mana and `use_magic`. Specials remain.
- Current rooms use point type 1: cumulative damage includes overkill
  and damage subsequently healed. With no recorded player damage the
  score is 100; otherwise no enemy damage means 0. Remaining cases give
  up to 20 for enemy damage relative to its original health and, on a
  win, up to 80 for the player's undamaged share. Clamp the final score
  to 0–100. A loss still earns its damage share. Older point type 0 uses
  a victory bonus and survivor fractions whose denominators are the
  original slot-array lengths, including empty places.
- The result waits three seconds, then sends `finish_tournament_match`
  with `victim_id`, `attacker_won`, two-decimal-string `attacker_points`,
  `victim_points: 0`, and `tournament_id`. The server measures duration
  between start and finish. Surrender asks first, pauses the fight while
  asking, and records defeat with exactly zero points. The result uses
  the original victory/defeat pictures and returns to the tournament.
- Reopening an unfinished match recreates the saved armies and starts
  a fresh attempt; original health/positions are not saved. Its start
  timestamp resets on Start, as in the existing server and original
  client. Unfinished starts time out after an hour. Once queued spell
  and battle commands are saved, a locally completed result can be retried
  after a lost reply, including a reload in the same tab; a previously
  recorded result cannot be overwritten. A failed command save instead
  requires reloading the saved state without submitting that local result.

*Built:* `tournamentPlay.ts` and `rules/tournamentBattle.ts`, reusing
`Battle`, `Specials`, `BattleView` and `BattleControls`. Rule tests cover
scores, placement, original-army accounting, opponent orders, spells,
completion and surrender; browser checks cover real saved matches.

## Results, rankings and prizes

- Ready rooms open Matches, finished rooms Results; both tabs remain.
  Public/friends rooms show any entrant's three matches and enrolled
  team; weekly shows the human's three. Only an unfinished outgoing
  match offers Start. Played rows show win/loss and two-decimal points;
  other players' unplayed matches show Pending. Abandonment is marked.
- The deadline is ready date plus the configured duration (currently
  twenty-four hours). The original refreshes then, retrying every two
  minutes while still unresolved. The server closes unplayed matches
  on expiry, or completes early once the remaining human matches end.
- Public/friends results sum finished points and elapsed match times;
  order by points descending, then shorter time, retaining abandoned
  entrants and their completed scores. This table order is separate
  from winner eligibility: an abandoned high scorer may appear first,
  but a winner must not be abandoned and must have outgoing matches.
  Exact ties use original seat order on the server. Since the response
  puts its viewer first, the added `winner_id` supplies the authoritative
  winner to the panel. Departure labels do not demote the score row.
- Weekly results show the server's top ten, total users and separate
  own-rank row, including ranks outside ten. Prize index is rank minus
  one for the top ten only. The player's paid rank is frozen when their
  room finishes, even if later results alter the live leaderboard.
- **There is no claim service.** The server pays the prize when ending
  the room: gold to the current town, cash to the player, unit rewards
  through `inventory.add_gift`. Those gift-box entries appear in this
  client's Storage, not the separate social Gifts panel. Public prizes
  use the room's saved reward index, not today's list index.
- Flash acknowledged a delayed finished popup and cleaned the room.
  Here the panel retains results until Done sends `clean_tournament`,
  or the server removes the room after its existing 30-day
  `KEEP_FINISHED` retention, measured from `date_finished`.
  Done only marks them seen and permits another enrollment; it pays
  nothing. Home balances and stored prizes are refreshed. Repeated
  finish, info and clean requests do not pay again. Weekly rooms retain
  their week's entered/ranking state after acknowledgement.
- Original cleanup supplies only the user id. The new client's Done
  also supplies the displayed `tournament_id`: an intentional optional
  safety extension. Under the same atomic service operation, a supplied
  mismatching id is ignored so a delayed old acknowledgement cannot
  hide a newer finished room. Omitting the id retains original behavior;
  the service name/envelope and all fee/prize rules are unchanged.

*Built:* `ui/tournamentResults.ts`, result helpers in
`rules/tournaments.ts` and server tie metadata in `tournaments.py`.
Tests cover exact ties, abandonment, frozen weekly rank, out-of-prize
rank, stale room actions and repeated payment/acknowledgement paths.
Final integrated test results and the exact tested commit belong in
HANDOFF.md, rather than being inferred from these implementation notes.
