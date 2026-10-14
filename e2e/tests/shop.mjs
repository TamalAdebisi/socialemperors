// The shop: buy three farms in a row and a mill on a new town, with the
// original's limits (one mill each), and the server's save agrees.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const FARM = 10, MILL = 5;
const FARMS = [[42, 53], [47, 51], [47, 53]], MILL_SPOT = [46, 49], HALL = [52, 52];

export default async function shop({ newPlayer }) {
  const player = await newPlayer();
  const before = await player.saved({ waitForBatch: false });

  await player.press("Build");
  await player.wait(1500);  // pictures load as their cards come into view
  await player.shot("village");
  assert.ok(await player.page.locator(".shop-card").count() > 0, "the shop shows something to build");
  await player.press("Resources");
  await player.wait(800);
  await player.shot("resources");

  // Farms, one after another until Done; the town hall's spot is taken.
  await player.card("Farm Land").click();
  await player.wait(300);
  await player.tapTile(HALL);
  assert.notEqual(await player.status(), "", "placing on the town hall says why not");
  for (const spot of FARMS) await player.tapTile(spot);
  await player.shot("placing");
  await player.press("Done");

  await player.press("Build");
  await player.card("Mill I").click();
  await player.tapTile(MILL_SPOT);
  await player.press("Build");
  await player.press("Resources");
  assert.ok(await player.card("Mill I").isDisabled(), "only one Mill I per town");
  await player.page.keyboard.press("Escape");
  assert.ok(await player.page.locator(".shop").isHidden(), "Escape closes the shop");

  const map = await player.saved();
  for (const spot of FARMS) assert.ok(has(map, FARM, spot), `a farm at ${spot}`);
  assert.ok(has(map, MILL, MILL_SPOT), "the mill");
  // Building gives experience: the mill reaches level 2, whose prize is 50 wood.
  assert.equal(map.level, 2, "level 2");
  assert.equal(map.wood, before.wood - 3 * 60 - 100 + 50, "three farms at 60 wood, a mill at 100, and level 2's 50");

  await player.reload();
  await player.shot("reloaded");
}
