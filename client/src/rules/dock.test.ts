import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { givenOnOpening, HARBOUR, levelThirtyFive, ZEPPELIN_TOWER } from "./dock.ts";
import type { PlacedItem, Town } from "./town.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House I", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 3, unitsLimit: 0, cashCost: 0,
    cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", upgradesTo: 0, ...fields };
}

const HARBOR = item({ id: HARBOUR, name: "Harbor", width: 4, height: 4 });
const TOWER = item({ id: ZEPPELIN_TOWER, name: "Zeppelin Tower", width: 4, height: 4 });
const PRINCESS = item({ id: 83, name: "Prisoner Princess", race: "e" });
const ACADEMY = item({ id: 416, name: "Wizardry Academy", width: 3, height: 3, subcategory: 139 });
const ITEMS = new Map([HARBOR, TOWER, PRINCESS, ACADEMY].map((i) => [i.id, i]));

function placed(what: ItemInfo, tx: number, ty: number): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
}

// Blocks 12 and 13 (x 40 to 79, y 40 to 59) are the player's.
function town(level: number, items: PlacedItem[] = [], race = "h"): Town {
  return { id: 0, name: "", townName: "", level, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race, skin: 0, expansions: new Set([12, 13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("a human town is given a harbour near (59, 59), staffed by 20 free helpers and opened", () => {
  const t = town(5);
  const given = givenOnOpening(t, ITEMS);
  assert.equal(given.length, 1);
  const { placed: harbour, commands } = given[0];
  assert.equal(harbour.item.id, HARBOUR);
  assert.ok(t.items.includes(harbour));
  assert.ok(Math.abs(harbour.tx - 59) + Math.abs(harbour.ty - 59) <= 2, `${harbour.tx}, ${harbour.ty}`);
  assert.deepEqual(commands[0], { cmd: "buy", args: [HARBOUR, harbour.tx, harbour.ty, 0, 0, 1, 1, "b"] });
  assert.equal(commands.filter((c) => c.cmd === "buy_si_help").length, 20);
  assert.deepEqual(commands.at(-1), { cmd: "finish_si", args: [harbour.tx, harbour.ty, 0, HARBOUR] });
  assert.equal(givenOnOpening(t, ITEMS).length, 0, "once only");
});

test("not with the princess waiting, nor one in storage or the gift box, nor in a troll town; the zeppelin tower from level 30", () => {
  assert.equal(givenOnOpening(town(5, [placed(PRINCESS, 70, 45)]), ITEMS).length, 0);
  const stored = town(5);
  stored.store.set(HARBOUR, 1);
  assert.equal(givenOnOpening(stored, ITEMS).length, 0);
  const gift = town(5);
  gift.gifts.set(HARBOUR, 1);
  assert.equal(givenOnOpening(gift, ITEMS).length, 0, "nor one in the gift box");
  assert.equal(givenOnOpening(town(40, [], "t"), ITEMS).length, 0);
  assert.deepEqual(givenOnOpening(town(29), ITEMS).map((g) => g.placed.item.id), [HARBOUR]);
  const both = givenOnOpening(town(30), ITEMS);
  assert.deepEqual(both.map((g) => g.placed.item.id), [HARBOUR, ZEPPELIN_TOWER]);
  const [harbour, tower] = both.map((g) => g.placed);
  assert.ok(Math.abs(harbour.tx - tower.tx) >= 4 || Math.abs(harbour.ty - tower.ty) >= 4, "side by side, not on top");
});

test("level 35: a Wizardry Academy for nothing, near (59, 59), even with one already", () => {
  const t = town(35, [placed(ACADEMY, 50, 50)]);
  const given = levelThirtyFive(t, ITEMS)!;
  assert.equal(given.placed.item.id, 416);
  assert.ok(Math.abs(given.placed.tx - 59) <= 3 && Math.abs(given.placed.ty - 59) <= 3, `${given.placed.tx}, ${given.placed.ty}`);
  assert.deepEqual(given.commands, [{ cmd: "buy", args: [416, given.placed.tx, given.placed.ty, 0, 0, 1, 1, "b"] }]);
  assert.equal(t.items.filter((p) => p.item.id === 416).length, 2);
});
