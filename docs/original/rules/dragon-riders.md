# Dragon riders and taming

Read locally on 17 October 2026: `PopupDragonRiders`,
`PopupDragonRiderTraining`, `PopupDragonTaming`,
`WindowMiniGameDragonRider`, `IsoUnit.CanEnterBuilding`, the two building
cards in `RecuadroInfo`, `MapInitializer.buyElementNoResources`, the config's
`DRAGON_RIDERS` and `DRAGONS` tables, and the separate shipped `SagaOTDC.swf`.
These notes describe behavior in our own words; no original source is
published. Combat delegates remain a separate task.

- The Rider Academy opens the picker when no rider is being trained,
  otherwise the saved training. The three riders unlock at the configured
  levels (35, 40, 45). Choosing one sends `rider_select` with 1, 2 or 3.
  Previewing shows compatible dragons in config item order, up to 48
  portraits, and the original attack/life gain text.
- Five, six or seven successful adventures complete the training. Each
  starts a 15-hour recovery, including the last. `rider_next_step ["1"]`
  advances the saved step and timestamp. A failed or closed adventure
  changes neither. Recovery can be bought off for the configured 15 cash
  with `rider_buy_step_cash [15]`. *Ours: for 7,500 food instead, the
  owner's rule of 29 October 2026 (CLIENT.md, "Speed-ups cost food"); the
  command is the same.* A page-session flag then exposes
  **Fast train**, which completes later adventures without playing them;
  every shortcut still starts its recovery. The flag also survives closing
  and reopening the window, and resets when the page reloads.
- Once all steps and the last recovery are complete, **Get rider** places
  the configured rider free on a nearby free tile, then resets training
  with `rider_select ["0"]` in the same ordered command batch. No population or ordinary training purchase
  check applies to this free reward. No room means no reset.
- Dragon Riding admits riders 822–824 and untamed dragons named in
  `DRAGONS`. It accepts one of each in either order. Two dragons or two
  riders cannot share it. An incompatible rider type may enter, but the
  taming window explains the mismatch and cannot transform it. Summoned
  combat units do not use this persistent town entry path.
- The taming window shows the pair, **Take out** for each, the configured
  mounted result and its stats/gains, and the original help. Removing one
  uses ordinary `pop_unit` placement and closes the window.
- **Ride the Dragon** starts adventure 8. Closing or losing preserves the
  pair. Winning needs a nearby free tile before consuming either input;
  then two `pop_unit` commands without placement remove the pair, followed
  by a free `buy` of the configured mounted dragon. Taming costs no money.
- The original adventures live in a separate, shipped asset, not in the
  town engine. Its parent starts the chosen adventure and receives the
  original success/failure callbacks. The new client plays that unchanged
  asset through the existing pinned Ruffle runtime and our own small
  loader. It pauses the town while playing. Native touch buttons send the
  same movement/jump/attack key events, including release on cancellation
  or focus loss; Escape/Close leave without advancing.

**Explicit repair:** later config rows spell the mounted output `tamed_id`
instead of `tamedId`, although the old window reads only the latter. Both
spellings now name the same output in the new client. This repairs the
existing data mismatch without changing pair eligibility or rewards.

**Built:** `client/src/rules/dragonRiders.ts`, `ui/dragonRiders.ts`,
`ui/riderAdventure.ts`, the configured dragon entry metadata and
`rules/work.ts`. `tools/art/export_riders.py` exports only original art;
`tools/art/build_minigame_bridge.sh` compiles only our loader source.
The focused Chromium fixture passed with genuine first-adventure success
and eighth-adventure loss via their original end-screen callbacks, and a
phone success adapter separately for the saved transformation. See
[the verification record](../../verification-dragon-riders.md) for actual
run status, renderer evidence and failed attempts. It does not claim a
full playthrough of all eight platformer adventures.
