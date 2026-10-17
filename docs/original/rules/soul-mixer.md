# Soul Mixer: later original rules and missing content

Researched locally on 17 October 2026. The deployed classic client is
`SocialEmpires0926bsec`; it contains no Soul Mixer implementation. The
preserved later `SocialEmpires1.4.07sec.swf` does. Its source stays only
in ignored `decompiled/`; these notes describe behaviour in our own words.

Read through: `popups/PopupSoulMixer`, its local `SoulMixerItem` and
`SoulMixerPoweredUnit` state, `popups/params/SoulMixerParams`,
`GUI/extendedPortraits/EP_SelfSoulMixer`, `managers/BuildingQueueManager`,
`managers/BuildingQueue/BuildingQueueData`, `popups/PopupGenericUnitSelector`
and its parameters, and `managers/goals/GoalSoulMixerGet`. Relevant parts
also read: `core/Constants`, `Config`, `Language`, `statics/StaticData`,
`DynamicData`, `isoengine/IsoBuilding`, `IsoUnit`, `IsoEngine`, `Base`,
`MapInitializer`, `managers/PlayerStatus` and `PopupManager`.
The three `AbstractEp*` portrait bases were also read for active-work
guards: moving, storing and selling are refused; turning stays available.

## Status and the data blocker

The window, generic rules and original queue commands are implemented in
`client/src/ui/soulMixer.ts`, `client/src/rules/soulMixer.ts` and
`soul_mixer.py`. **New mixes are unavailable with the shipped config.**
The window explains the limitation. New selection, ordinary map entry,
new mixing and every cash-spending action require complete validated
content. Known completed legacy work can still be collected without
spending; an unknown duration is never treated as completion.

| Missing original data | Meaning |
| --- | --- |
| Each eligible item's `breeding_order` | Input eligibility and result ordering |
| Each eligible item's `sm_training_time` | The result's wait, in seconds |
| `globals.SOUL_MIXER_POWERUPS_LEVELS` | Cash prices and ordering increments |
| `globals.SOUL_MIXER_MIN_LEVEL` | Level for the passive free building |

`config/patch/soulmixer_temp.json` supplies a temporary building record and
art name, not these tables. The later static-data reader gets the item
fields from the server; the window gets power-ups from globals. Neither
provides default values. Recovery checked every historical config payload,
including July/August 2012 PHP responses, `4399_config.json`,
`game_config_4399.json`, `main.json`, patches and mods. None has the data.
A read-only check of the preservation project's
[original config directory](https://github.com/AcidCaos/socialemperors/tree/main/config)
found the same earlier files and temporary patch. Exact-key public searches
found no later dump. Community combination lists do not provide the full
ordering and wait tables and are not used as replacement content.

## Selection and result rules

- Its card opens the window. Original background, empty-soul picture,
  action icon and four help images are in `assets/externalized/`.
- Two owned units standing in town with positive `breeding_order` move
  straight inside using `push_unit`. Both survive. Two separate units of
  the same kind are allowed. The original army picker excludes villagers,
  animals, settlers, carts and summons.
- The result uses 30% of the weaker rank and 70% of the stronger, rounded
  up with a minimum 10, plus a random integer 0–11. Matching the stronger
  input's rank advances once. Results above 400 instead roll the upper
  range from 400 to the greatest configured rank, excluding that endpoint.
  The first ordered eligible unit at least that rank is chosen, excluding
  both input kinds; the original falls back to its last entry.
- The result stays a silhouette before completion. Preview state survives
  closing/reopening the window in the same page, but is not server-saved
  before starting. Reloading can regenerate it.
- Power-up price uses the current tier; its rank increment uses the next
  tier. Both clamp to the last configured tier. Earlier results join the
  exclusions; rank 400 or higher rolls the upper range again. Replacing a
  soul after upgrades warns that those upgrades will be lost.
- Below level 20, Galaxy, Rainbow, Crystal and Infernal Dragons cannot be
  mixed or powered up. Result unit limits are checked before starting.
- Ours refuses a power-up with no remaining candidate before charging;
  the original could run past its list. DECISIONS.md records this repair.

## Queue, collection and rules without a button

- Starting sends `buy_powerups` per upgrade, then `push_queue_unit`, naming
  building tile, id 1529, result id, queue id and zero purchase flag. No
  ordinary training gold/food is charged and output grants no training XP.
- Building `attrs.bq` points into `privateState.barracksQueues`, whose
  entry has `ts`, `amount`, `unit`. The two parents remain in the building's
  contained-unit list. The result's `sm_training_time` is the duration.
- Queue identifiers remain reserved globally after collection and when
  their building belongs to another town. New buildings allocate above
  all saved identifiers, including completed entries, preserving the
  original `bq` identity instead of reusing another building's queue.
- Queues restore on opening town before any window opens. Unlike later
  ordinary barracks, completed mixer work waits for Get unit. A zero
  timestamp means speed-up finished it. A positive timestamp without its
  duration is unreadable; ours never assumes it finished.
- `speed_up_queue` costs one cash per started hour left. Get unit checks
  population/free space, sends `pop_queue_unit`, then ordinary `pop_unit`
  commands return both parents. Our server ignores repeated collection.
- Active work protects the building and its parents. The later original
  expressly refuses moving, storing or selling a training mixer; turning
  remains available. Ours rechecks when old card/confirmation callbacks
  execute, and its server rejects late destructive commands too. A native
  panel may stay open while its building changes, so every mutation
  checks the live building and current parents before using its preview.
- Map initialization and level-up check `SOUL_MIXER_MIN_LEVEL`; without
  a placed or stored/gift mixer the later original tries to give one free
  near tile 59,59. Ours guards that check on complete original content;
  no guessed level or unusable free building is introduced.
- The later goal listener counts mixing starts. None of the 227 shipped
  missions has that goal, so the unfinished-goal count is unchanged and
  no later progression goals are added.

## Verification

Sixteen focused client tests cover ranking, tier ordering, restrictions, limits,
command arguments, save restore, waiting, speed-up, population, surviving
parents, passive grants, global queue reservations and stale editor callbacks. Ten server tests
replay the queue protocol, missing/partial-data refusal, elapsed work,
retries, malformed timestamps, late edit commands and safe collection. Their
synthetic tables are confined to tests and never shipped.
`e2e/tests/soul-mixer.mjs` checks original help art, desktop/phone fit,
reload and unchanged saved units, cash and queues in the current
unavailable state. Exact clean `c944e853` passed focused Chromium 1/1 in 67s;
all three fresh captures and the clean local server log were reviewed.
Server459 (nine existing skips), types and client 420/420 also passed.
The [delivery record](../../verification-soul-mixer.md) preserves scope
and the original-data blocker. No playable new mixing is claimed.
