# Tournament list and team selection

Read locally on 16 October 2026: `PopupTournament`, `ThumbTournament`,
`ThumbWeeklyTournament`, `SelectionTeamWindow`, `ThumbUnit`,
`ThumbSelectedUnit`, `RecuadroTeamTournament`, `PopupHelp`, the list,
entry and status parts of `TournamentManager`, `ServiceManager`,
`IsoEngine.refreshTotalPlayerUnits`, the saved storage/gifts in `Base`,
the menu gate in `GuiManager` and its level in `Config`. The decompiled
source remains local and ignored. These notes are in our own words.

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
cards for the agreed panel. Prize previews on everyday/friends' cards
are informational. Weekly ranking/prize windows remain classic.

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

## Entry: preserved for the next slices

- Public/friends entry checks ownership, the complex cap, a nonempty
  team and confirmation for a short team. Weekly entry skips the complex
  cap, checks empty/short teams, and warns within the last ten minutes.
  The shared editor still applies its own cap; these are distinct checks.
- Join's original payload contains `user_id`, `tournament_type_id`,
  `category`, twenty-id `team`, `tournament_id` (empty for public/weekly)
  and `flashSubResources: 1`. Categories are 1 for levels 15–20, 2 for
  21–25, 3 for 26–30, 4 for 31–40 and 5 above 40.
- The original sends `tournament_substract_resources` (spelling kept)
  with resource, amount, type and private flag before joining. Our server
  already takes/refunds actual fees in its service; bookkeeping commands
  are deliberate no-ops. Do not take the fee twice.
- `tournaments.py` supplies four-seat public rooms, bot filling after
  thirty minutes, weekly reuse flags, friends' visibility, and saved
  rooms. Its existing tests cover these, entry validation and fees.

*Later:* joining/waiting room, matches, results and paying prizes, friends'
creation/invites. This slice uses classic links, flushing queued saves
before navigation; it sends no join, fee, leave, clean or match commands.
