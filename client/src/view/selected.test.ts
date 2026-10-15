import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "../rules/config.ts";
import { TILE_HEIGHT, buildingPoint, unitPoint } from "../rules/geometry.ts";
import type { PlacedItem } from "../rules/town.ts";
import { lifeShare, selectedName, selectedPoint } from "./selected.ts";

const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "1", name: "House I", type: "b", img_name: "casa1", width: "2", height: "2", category_id: "1", subcat_functional: "0", life: "400",
  ...fields,
});
const at = (fields: Partial<ConfigItem>, more: Partial<PlacedItem> = {}): PlacedItem =>
  ({ item: itemInfo(config(fields)), tx: 50, ty: 40, orientation: 0, unitsInside: 0, units: [], startedAt: 0, workTime: 0, ...more });

test("a unit stands on the ring; a building gets the outline of its size, 6x6 for anything wider", () => {
  assert.equal(selectedName(at({ type: "u", width: "1", height: "1" })), "selected-unit");
  assert.equal(selectedName(at({ width: "1", height: "1" })), "selected-1x1");
  assert.equal(selectedName(at({})), "selected-2x2");
  assert.equal(selectedName(at({ width: "5", height: "5" })), "selected-5x5");
  assert.equal(selectedName(at({ width: "8", height: "8" })), "selected-6x6");
});

test("the outline goes on a building's point; the ring half a tile below a unit, walking too", () => {
  assert.deepEqual(selectedPoint(at({})), buildingPoint(50, 40));
  const unit = at({ type: "u", width: "1", height: "1" });
  const stands = unitPoint(50, 40);
  assert.deepEqual(selectedPoint(unit), { x: stands.x, y: stands.y + TILE_HEIGHT / 2 });
  assert.deepEqual(selectedPoint(unit, { x: 10, y: 20 }), { x: 10, y: 20 + TILE_HEIGHT / 2 });
});

test("the life bar: whole, or what a raid left", () => {
  assert.equal(lifeShare(at({})), 1);
  assert.equal(lifeShare(at({}, { health: 100 })), 0.25);
  assert.equal(lifeShare(at({}, { health: 0 })), 0);
  assert.equal(lifeShare(at({ life: "0" }, { health: 0 })), 1, "nothing to lose");
});
