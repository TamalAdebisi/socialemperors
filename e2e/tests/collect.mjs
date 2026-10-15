// Producing buildings: a town set up as the Flash client would (a farm and a
// gold mine with a villager each, a sheep ranch with a sheep), then choosing
// a working time and collecting in the new client. The ranch's harvest uses
// up its sheep, as in the Flash client. Takes about a minute and a half: the
// ranch needs 90 seconds.

import assert from "node:assert/strict";
import { itemAt } from "../lib.mjs";

const FARM = [10, 42, 53], RANCH = [11, 47, 58], MINE = [13, 46, 49];
const VILLAGER = 500, SHEEP = 505, SPOTS = [[43, 53], [44, 53], [46, 50]];
const WORKERS = [VILLAGER, SHEEP, VILLAGER];  // into the farm, the ranch, the mine

export default async function collect({ newPlayer }) {
  const player = await newPlayer();
  // The Flash client's commands: buy each building and a villager, then each villager walks in.
  const setup = [];
  for (const [id, x, y] of [FARM, RANCH, MINE]) setup.push({ cmd: "buy", args: [id, x, y, 0, 0, 0, 1] });
  SPOTS.forEach(([x, y], i) => setup.push({ cmd: "buy", args: [WORKERS[i], x, y, 0, 0, 0, 1] }));
  [FARM, RANCH, MINE].forEach(([, bx, by], i) => setup.push({ cmd: "push_unit", args: [...SPOTS[i], WORKERS[i], bx, by, 0] }));
  await player.send(setup);
  const setUpAt = Date.now();
  const before = await player.saved({ waitForBatch: false });
  await player.reload();
  await player.shot("start");

  // The mine's villager waits for a working time; tapping the mine asks how long.
  const mine = await player.select(MINE.slice(1), "How long should Gold Mine I work?");
  await player.shot("picker");
  await player.press("5 min: 100 gold");
  await player.click(mine.point);
  const mineWorking = await player.bar();
  assert.ok(mineWorking.startsWith("Gold Mine I") && !mineWorking.includes("How long"), `the mine works: "${mineWorking}"`);
  await player.press("Close");

  // The farm and the ranch are working: selecting one shows how long is left.
  const farm = await player.select(FARM.slice(1), "Farm Land");
  await player.press("Close");
  await player.select(RANCH.slice(1), "Sheep Ranch I");
  await player.press("Close");

  // The farm is ready 32.4 s after its villager walked in: one tap collects,
  // and what it gave rises over it ("+15 food").
  await player.wait(Math.max(0, setUpAt + 34_000 - Date.now()));
  await player.shot("farm-ready");
  await player.page.mouse.click(farm.point.x, farm.point.y);
  await player.wait(250);
  await player.shot("farm-collected");
  assert.equal(await player.bar(), "", "collecting doesn't select the farm");

  // After 90 s the ranch is ready, and the farm again: the glove shows, with how many, and collects both.
  await player.wait(Math.max(0, setUpAt + 92_000 - Date.now()));
  assert.equal((await player.button("Collect all").textContent()).trim(), "2", "the glove counts the farm and the ranch");
  await player.press("Collect all");
  await player.shot("ranch-collected");
  assert.ok(await player.button("Collect all").isHidden(), "nothing's ready now: the glove goes");

  const after = await player.saved();
  const startedAfterSetup = (building) => itemAt(after, building[0], building.slice(1))?.[4] - Math.floor(setUpAt / 1000);
  assert.ok(startedAfterSetup(FARM) >= 88, "the farm started again when collected the second time");
  assert.ok(startedAfterSetup(RANCH) >= 88, "the ranch started again when collected");
  assert.deepEqual(itemAt(after, RANCH[0], RANCH.slice(1))?.[6] ?? [], [], "its harvest used up the sheep, for good");
  // (The town's wild sheep stay in their corner: lib.mjs, FULL_WILD.)
  const onTheirLand = (i) => i[1] >= 40 && i[1] < 60 && i[2] >= 40 && i[2] < 60;
  assert.ok(!after.items.some((i) => i[0] === SHEEP && onTheirLand(i)), "and it isn't back on the map");
  assert.ok(startedAfterSetup(MINE) >= 0, "the mine started when its time was chosen");
  assert.ok(after.xp > before.xp, `collecting gives experience: ${before.xp} -> ${after.xp}`);
  assert.ok(after.food > before.food, `the farm and ranch give food: ${before.food} -> ${after.food}`);
}
