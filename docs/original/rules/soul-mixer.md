# Soul Mixer: later original rules, and its tables rebuilt from the wiki

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

## Status: working, with tables rebuilt from the wiki

The window, generic rules and original queue commands are implemented in
`client/src/ui/soulMixer.ts`, `client/src/rules/soulMixer.ts` and
`soul_mixer.py`. The original's content tables were not preserved:

| Original data | Meaning | Ours, since 20 October 2026 |
| --- | --- | --- |
| Each eligible item's `breeding_order` | Input eligibility and result ordering | Strength order, moved for the wiki's recipes |
| Each eligible item's `sm_training_time` | The result's wait, in seconds | 3 hours to 5 days 10 hours, by rank (the wiki's two times) |
| `globals.SOUL_MIXER_POWERUPS_LEVELS` | Cash prices and ordering increments | 1 to 7 cash (the wiki's "+1" and "+3"), increment 0 |
| `globals.SOUL_MIXER_MIN_LEVEL` | Level for the passive free building | 8, the shop's level (the wiki doesn't say) |

The owner asked (19 October 2026) for these to be rebuilt from the Social
Empires Tips Wiki's "Soul Mixer Combinations" page, which they saved and
uploaded. `config/soulmixer_wiki.json` holds them, with the source of
every value; `tools/soul_mixer_wiki.py` makes it, using an exact copy of
the rules below to check that the wiki's recipes can give their results.
The server applies the file (`get_game_config.soul_mixer_from_the_wiki`)
only when the config has no `breeding_order` of its own, so a genuine
later config, if one is ever found, replaces it unchanged. DECISIONS.md
lists the calls.

`config/patch/soulmixer_temp.json` supplies the building record and art
name. Recovery before the wiki checked every historical config payload,
including July/August 2012 PHP responses, `4399_config.json`,
`game_config_4399.json`, `main.json`, patches and mods, and the
preservation project's
[original config directory](https://github.com/AcidCaos/socialemperors/tree/main/config):
none has the data.

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
- Saved `ts`, `unit` and `amount` must be nonnegative safe integers. Text
  must contain 1–16 ASCII decimal digits and fit the same range. Decimal,
  exponent, signed and whitespace text is refused before conversion,
  preventing underflow or rounding from creating apparently completed
  work. Explicit numeric or text zero remains a known legacy completion.
- A completed legacy result must resolve to an actual unit (`type: "u"`),
  not merely a known item id. Malformed building outputs leave work,
  cash and both parents unchanged.
- `speed_up_queue` costs one cash per started hour left. Get unit checks
  population/free space and sends `pop_queue_unit`. The later client then
  returns both parents with ordinary `pop_unit` commands (`popAll`). **Ours
  doesn't, since 28 October 2026:** the owner remembers the game taking
  the two units' souls, two in and one out, and the original server isn't
  preserved to say otherwise. Collecting empties the mixer, and our
  server refuses a `pop_unit` of a parent no longer inside, so a later
  client's request can't bring one back. Our server ignores repeated
  collection.
- Active work protects the building and its parents. The later original
  expressly refuses moving, storing or selling a training mixer; turning
  remains available. Ours rechecks when old card/confirmation callbacks
  execute, and its server rejects late destructive commands too. A native
  panel may stay open while its building changes, so every mutation
  checks the live building and current parents before using its preview.
- Map initialization and level-up check `SOUL_MIXER_MIN_LEVEL`; without
  a placed or stored/gift mixer the later original tries to give one free
  near tile 59,59. Ours does the same once the tables are complete (with
  the wiki's, from level 8).
- The later goal listener counts mixing starts. None of the 227 shipped
  missions has that goal, so the unfinished-goal count is unchanged and
  no later progression goals are added.

## Verification

Eighteen focused client tests cover ranking, tier ordering, restrictions,
limits, command arguments, save restore, waiting, speed-up, population,
used-up parents, passive grants, global queue reservations and stale
editor callbacks, on synthetic tables. The server tests replay the queue
protocol with no tables, with synthetic ones and with the wiki's (a real
mix of two Valkyries, its wait, speed-up and collection; gods and colossi
in the top range). `e2e/tests/soul-mixer.mjs` plays a real mix in the
browser, the original help, the phone sheet and old saves. The earlier
record of the blocked state is in
[the delivery record](../../verification-soul-mixer.md).
