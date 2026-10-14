import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { choices, fits, footprintTiles, isOpenLand, move, refund, sell, store, takenTiles, turn } from "./editing.ts";
import type { PlacedItem, Town } from "./town.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h", ...fields };
}

function placed(fields: Partial<ItemInfo>, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: item(fields), tx, ty, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0, ...more };
}

function town(items: PlacedItem[] = [], expansions = [13]): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 5, gold: 100, wood: 100, food: 100, stone: 100,
    race: "h", skin: 0, expansions: new Set(expansions), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("the save names a building's last tile; it covers width x height back from there", () => {
  assert.deepEqual(footprintTiles(placed({}, 52, 52)).sort(), [[51, 51], [51, 52], [52, 51], [52, 52]]);
  assert.deepEqual(footprintTiles(placed({ isUnit: true }, 50, 40)), [[50, 40]]);
});

test("bought land: the save's expansions, on the map", () => {
  const t = town([], [13, 14]);
  assert.equal(isOpenLand(t, 40, 40), true);   // block 13
  assert.equal(isOpenLand(t, 60, 40), true);   // block 14
  assert.equal(isOpenLand(t, 40, 60), false);  // block 18, not bought
  assert.equal(isOpenLand(t, -1, 50), false);  // off the map
});

test("a building fits on bought, free land; standing units are in its way", () => {
  const hall = placed({ width: 4, height: 4 }, 52, 52);
  const soldier = placed({ isUnit: true, width: 1, height: 1 }, 45, 45);
  const t = town([hall, soldier]);
  assert.equal(takenTiles(t).size, 17);
  assert.equal(fits(t, placed({}, 47, 47)), true);
  assert.equal(fits(t, placed({}, 48, 48)), true);   // touching the hall's corner
  assert.equal(fits(t, placed({}, 49, 49)), false);  // on its corner tile
  assert.equal(fits(t, placed({}, 45, 45)), false);  // on the soldier
  assert.equal(fits(t, placed({}, 40, 40)), false);  // half off the bought land
});

test("moving: the old place doesn't count, and the command is the Flash client's", () => {
  const house = placed({ id: 1 }, 50, 50, { orientation: 1 });
  const t = town([house]);
  assert.equal(move(t, house, 40, 40), null);  // doesn't fit: nothing changes
  assert.deepEqual([house.tx, house.ty], [50, 50]);
  assert.deepEqual(move(t, house, 51, 51), { cmd: "move", args: [50, 50, 1, 51, 51, 1, 0, "mouseUsed"] });
  assert.deepEqual([house.tx, house.ty], [51, 51]);
});

test("turning goes round the item's ways of facing", () => {
  const tower = placed({ facings: 2 }, 50, 50);
  const t = town([tower]);
  assert.deepEqual(turn(t, tower), { cmd: "orient", args: [50, 50, 1, 0] });
  assert.deepEqual(turn(t, tower), { cmd: "orient", args: [50, 50, 0, 0] });
});

test("selling gives back a twentieth of the cost, in what it cost; nothing for cash", () => {
  const house = placed({ id: 1, cost: 30, costType: "w" }, 50, 50);
  const t = town([house]);
  assert.deepEqual(sell(t, house), { cmd: "sell", args: [50, 50, 1, 0, 0, "BLDZE"] });
  assert.equal(t.wood, 101);  // 30 / 20, rounded down
  assert.deepEqual(t.items, []);
  assert.equal(refund(item({ cost: 20, costType: "c" })), null);
  assert.deepEqual(refund(item({ cost: 1000, costType: "g" })), { resource: "gold", amount: 50 });
});

test("storing takes it off the map, into the town's store", () => {
  const house = placed({ id: 1 }, 50, 50);
  const t = town([house]);
  assert.deepEqual(store(t, house), { cmd: "store_item", args: [50, 50, 0, 1] });
  assert.deepEqual(t.items, []);
  assert.deepEqual([...t.store], [[1, 1]]);
});

test("what can be done depends on what it is, and whose, as in the Flash client", () => {
  const can = (fields: Partial<ItemInfo>, more: Partial<PlacedItem> = {}, at = 50) => {
    const { why: _, ...rest } = choices(town(), placed(fields, at, at, more));
    return rest;
  };
  const NONE = { move: false, turn: false, store: false, sell: false };
  assert.deepEqual(can({}), { move: true, turn: true, store: true, sell: true });
  assert.deepEqual(can({ subcategory: 135 }), { move: true, turn: true, store: false, sell: false });  // town hall
  assert.deepEqual(can({ race: "a" }), { move: true, turn: true, store: true, sell: true });   // anyone's: the player's too
  assert.deepEqual(can({ race: "t" }), NONE);                                                 // the trolls'
  assert.deepEqual(can({ isUnit: true }), NONE);
  assert.deepEqual(can({}, { unitsInside: 2 }), NONE);
  assert.deepEqual(can({}, {}, 5), NONE);  // on the wild ring
  // Nobody's: trees stay; gold and stone rocks can be cleared, but only from bought land.
  assert.deepEqual(can({ race: "n", subcategory: 125 }), NONE);
  assert.match(choices(town(), placed({ race: "n", subcategory: 125 }, 50, 50)).why, /villager/);
  assert.deepEqual(can({ race: "n", subcategory: 126 }), { ...NONE, sell: true });
  assert.deepEqual(can({ race: "n", subcategory: 127 }, {}, 30), NONE);  // block 7: not bought
});
