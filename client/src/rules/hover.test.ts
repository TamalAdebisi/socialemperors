import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { startBuilding } from "./construction.ts";
import { lights, popupOf } from "./hover.ts";
import type { PlacedItem } from "./town.ts";

const MILL = 5;
const item = (fields: Partial<ConfigItem>) => itemInfo({
  name: "Thing", type: "b", img_name: "x", width: "2", height: "2", category_id: "1", subcat_functional: "111",
  race: "h", ...fields,
} as ConfigItem, new Set([MILL]));
const placed = (info: ReturnType<typeof item>, more: Partial<PlacedItem> = {}): PlacedItem => ({
  item: info, tx: 55, ty: 55, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, ...more,
});

const farm = item({ id: "10", name: "Farm Land", subcat_functional: "122", unit_capacity: "1", activation: "100", collect: "15", collect_type: "f" } as Partial<ConfigItem>);

test("the mouse lights anything but scenery, and nothing being built", () => {
  assert.ok(lights(placed(item({ id: "1", name: "House I" })), 0));
  assert.ok(!lights(placed(item({ id: "63", subcat_functional: "1011" })), 0), "scenery");
  const house = placed(item({ id: "1" }));
  startBuilding(house, 1000);
  assert.ok(!lights(house, 2000), "being built");
  assert.ok(lights(house, 20_000), "built");
});

test("the popup: a house's name alone, none for a tower", () => {
  assert.deepEqual(popupOf(placed(item({ id: "1", name: "House I" })), 0), { name: "House I", round: null });
  assert.equal(popupOf(placed(item({ id: "29", name: "Tower I", category_id: "2" })), 0), null);
});

test("the popup of a building at work: how far along, and the time left", () => {
  const working = placed(farm, { unitsInside: 1, units: [500], startedAt: 1000 });
  assert.deepEqual(popupOf(working, 1025), { name: "Farm Land", round: { share: 0.25, secondsLeft: 75 } });
  assert.deepEqual(popupOf(working, 1200)?.round, { share: 1, secondsLeft: 0 }, "ready");
  assert.deepEqual(popupOf(placed(farm), 1025)?.round, { share: 0, secondsLeft: 100 }, "nobody inside: its whole round to go, as the game shows it");
});

test("a mill waiting for its working time: its name alone", () => {
  const mill = item({ id: String(MILL), name: "Mill I", subcat_functional: "121", unit_capacity: "2", activation: "0", collect: "10", collect_type: "w" } as Partial<ConfigItem>);
  assert.deepEqual(popupOf(placed(mill, { unitsInside: 1, units: [500], startedAt: 1000 }), 1025), { name: "Mill I", round: null });
});
