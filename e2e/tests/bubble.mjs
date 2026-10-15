// Small things (CLIENT.md, "Step 3"): a ready farm's bubble, tapped where
// only grass is behind it, collects the farm, as in the Flash client (the
// bubble was part of its building); a house sold shows its refund rising;
// and the land below, for sale, has its sign, and tapping there offers it
// (the last two looked at in the screenshots).

import assert from "node:assert/strict";

const FARM = [10, 55, 56], VILLAGER = 500, SPOT = [56, 57], HOUSE = [1, 46, 47];

export default async function bubble({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
    { cmd: "push_unit", args: [...SPOT, VILLAGER, FARM[1], FARM[2], 0] },
    { cmd: "buy", args: [...HOUSE, 0, 0, 1, 1] },
  ]);
  const setUpAt = Date.now();
  await player.reload();
  const before = await player.saved();

  // Ready after 32.4 seconds: the bubble stands over the field's middle.
  await player.wait(Math.max(0, setUpAt + 35_000 - Date.now()));
  const bubbleAt = player.screenOf(54.5, 55.5, 95);
  await player.shot("ready");
  await player.click(bubbleAt);
  const after = await player.saved();
  assert.equal(after.food, before.food + 15, "the bubble collected the farm");

  // A house sold: its refund rises from it.
  await player.select(HOUSE.slice(1), "House I");
  await player.press("Sell");
  await player.press("Sell");  // confirmed
  await player.wait(300);
  await player.shot("sold");

  // The land around the middle, zoomed out: each block has its sign in its middle.
  await player.page.keyboard.press("Escape");
  for (let i = 0; i < 3; i++) await player.page.keyboard.press("-");
  await player.wait(1500);
  await player.shot("for-sale");
}
