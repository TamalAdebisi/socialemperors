# Rule book: time and weather machines

Read locally on 17 October 2026: `popups/PopupSelectTime`,
`PopupHelpTimeMachine`, `PopupWeather`, their picture holders,
`GUI/RecuadroInfo`'s building entry points, `GUI/GuiManager.returnHomeUser`,
`utils/StageBlocker`, `GameStatic`'s theme pictures, `ImageManager`'s localized
image paths and `PlayerStatus`'s saved counts. These are our own notes;
the original code stays in ignored `decompiled/`.

## Entry and automatic behaviour

- The completed Time Machine (1463) has its original **Open** card button.
  The Weather Machine (373) has **Set weather**. Their ordinary card keeps
  Move, Turn and Store; neither machine offers Upgrade.
- Opening time packets for the first time records `timeMachineHelp` through
  `set_help_map` and opens the help without a separate button press. The
  question mark can show it again; opening an already-seen window does not.
- There is no confirmation before buying or using a packet, unlocking a
  terrain or applying an owned terrain. Missing cash changes nothing.

*Built:* `rules/machines.ts`, `ui/machines.ts`, `main.ts`. The same panel is
a phone sheet. Original card buttons and all six packet pictures are
exported by `tools/art/export_ui.py`; weather previews use the six original
localized `images_new` files.

## Time packets

- Six entries, in `globals.TIME_MACHINE` order: half an hour, one, four,
  eight, twelve and twenty-four hours. Prices also come from that table.
- Counts are player-wide, in `privateState.countTimePacket`; absent entries
  mean zero. Buying increments one count, charges its cash price and sends
  `buy_time_packet [index]` immediately. It does not use the packet.
- Using one with no stock gives the original warning and sends nothing.
  With stock, `time_ff [index]` consumes one and returns to the current town
  with refreshed save data. The duration labels are hard-coded in the
  original: `30 mins`, `1 hour`, through `1 day`; its English duration
  translation placeholders are not used.
- The original travelling cover shows the duration and has a minimum
  three-second animation. Our existing loading status shows its original
  travelling words and duration, then reloads after the save completes;
  the extra animation delay is omitted. A failed save keeps recovery in
  the open panel and does not reload automatically.

*Built:* the client sends the existing commands. `time_machine.py` keeps
all existing building, nest, rider, temple, daily bonus, darts-free-life,
survival-life and quest waits; it now also moves outgoing PvP attack times
and the corresponding reset threshold together. The original help
explicitly promises PvP speedup; received history, spy visits, Monday's
calendar bonus and the darts season date are left as before. The original
server is unavailable, so that narrow missing PvP wait is a documented
judgment based on the shipped help and counter calculation.

## Weather

- Theme IDs are **0, 1, 2, 4, 5, 6**. There is no selectable theme 3.
  The pictures are `CESPED.jpg`, `DESIERTO.jpg`, `NIEVE.jpg`, `MINERAL.jpg`,
  `SELVA.jpg` and `nubes.jpg`; their localized directories come from config.
- Grass (0) is always free. Other looks use the player-wide saved text
  unlock flag `"true"`. The current terrain has no active action.
- Choosing a locked look charges `globals.COST_UNLOCK_SKIN`, sends
  `unlock_skin [String(id)]`, then **also applies it** with
  `set_skin [town, String(id)]` and reloads the town. An owned look sends only
  `set_skin`; changing away and back does not charge again.
- Terrain is per town (`map.skin`); unlocks belong to the whole player.
  A saved change reuses the existing terrain and tree-skin rendering.

*Built:* `ui/machines.ts` with the existing `shop.py` and command handlers.

## Goals and verification

Goal 220 is the ordinary build requirement for weather building 373,
already handled by existing goals. No goal requires time-machine actions;
no progression hook or unsupported-goal count changes in this slice.

`e2e/tests/time-machine.mjs` checks automatic/reopened help, buying versus
using, counts/cash, a real working mine's saved timer and desktop/phone
reloads. `e2e/tests/weather-machine.mjs` checks all six pictures, unlock and
immediate application, free grass, retained ownership and no repeat charge
on desktop and phone. Unit checks cover configuration, saved counts,
labels, theme IDs and flags; server checks cover multi-town waits and the
PvP/calendar distinction. Exact run results belong to the delivery record.
