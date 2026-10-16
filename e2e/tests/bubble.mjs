// Small things (CLIENT.md, "Step 3"): a ready farm's bubble, tapped where
// only grass is behind it, collects the farm, as in the Flash client (the
// bubble was part of its building); a house sold with the bulldozer shows its refund rising;
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

  // Ready after 32.4 seconds: the bubble stands over the field's middle (from the next look the town takes).
  // Tapped in its middle: its tip, lower down, is missed now and then as it bobs.
  await player.wait(Math.max(0, setUpAt + 32_400 - Date.now()));
  const bubbleAt = player.screenOf(54.5, 55.5, 115);
  await player.page.waitForFunction((at) => window.seHome?.parts.view.itemAt(at)?.item.id === 10, bubbleAt, { timeout: 20_000 });
  await player.shot("ready");
  await player.click(bubbleAt);
  const after = await player.saved();
  assert.equal(after.food, before.food + 15, "the bubble collected the farm");

  // A house sold (with the bulldozer, as in the original): its refund rises from it.
  const house = await player.select(HOUSE.slice(1), "House I");
  await player.page.keyboard.press("Escape");
  await player.bulldoze(house.point);
  await player.shot("sold");

  // The land around the middle, zoomed out: each block has its sign in its middle.
  await player.page.keyboard.press("Escape");
  for (let i = 0; i < 3; i++) await player.page.keyboard.press("-");
  await player.wait(1500);
  await player.shot("for-sale");
}
