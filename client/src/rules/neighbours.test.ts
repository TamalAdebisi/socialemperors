import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { Helping, arthur, canBeHelped, cartMet, carts, deliver, helpedLately } from "./neighbours.ts";
import type { PlacedItem, Town } from "./town.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 5, name: "Mill I", isUnit: false, art: "x", width: 2, height: 2, category: 1, subcategory: 121,
    flying: false, velocity: 0, capacity: 1, activation: 0, collect: 300, collectType: "f", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0,
    cost: 30, costType: "w", facings: 1, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h", ...fields };
}
const MILL = item({});
const HOUSE = item({ id: 1, name: "House I", subcategory: 111 });

function placed(what: ItemInfo, tx: number, ty: number): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
}

test("Arthur is always a neighbour: his town grows with the player's, his level a fifth above theirs", () => {
  assert.deepEqual(arthur(5, 101), { pid: "100000030", name: "Arthur", level: 6 });
  assert.deepEqual(arthur(15, 101), { pid: "100000031", name: "Arthur", level: 18 });
  assert.deepEqual(arthur(30, 101), { pid: "100000032", name: "Arthur", level: 36 });
  assert.equal(arthur(99, 101).level, 100, "no higher than the last level");
});

test("what can be helped: working buildings, not houses, not the hatchery, not wonders that house people", () => {
  assert.equal(canBeHelped(MILL), true);
  assert.equal(canBeHelped(HOUSE), false);
  assert.equal(canBeHelped(item({ id: 226, subcategory: 123 })), false);
  assert.equal(canBeHelped(item({ subcategory: 511, population: 0 })), true);
  assert.equal(canBeHelped(item({ subcategory: 511, population: 25 })), false);
});

test("helping: 5 buildings a visit, each once, sent on leaving as one command; once a day", () => {
  const helping = new Helping("1234");
  const mills = [0, 1, 2, 3, 4, 5].map((i) => placed(MILL, 40 + 2 * i, 45));
  assert.deepEqual(helping.help(mills[0]), { gold: 10, xp: 3 });
  assert.match(helping.help(mills[0]) as string, /already/);
  for (const mill of mills.slice(1, 5)) helping.help(mill);
  assert.match(helping.help(mills[5]) as string, /5 buildings/);
  const sent = helping.finish()!;
  assert.deepEqual(sent.args.slice(0, 2), ["1234", 0]);
  assert.deepEqual(JSON.parse(sent.args[2] as string), mills.slice(0, 5).map((m) => [m.tx, m.ty, 5]));
  assert.equal(helping.finish(), null, "sent once");
  assert.equal(new Helping("x").finish(), null, "nothing helped, nothing sent");
  assert.equal(helpedLately({ u1234: 1000 }, "1234", 1000 + 3600), true);
  assert.equal(helpedLately({ u1234: 1000 }, "1234", 1000 + 86400), false);
});

test("carts bring a quarter of a harvest and 10 experience to each building helped", () => {
  assert.deepEqual(carts({ u77: [[44, 50, 5], [45, 51, 10]], u78: [] }), [{ helper: "77", buildings: [{ x: 44, y: 50, id: 5 }, { x: 45, y: 51, id: 10 }] }]);
  const town: Town = { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
  const brought = deliver(town, placed(MILL, 44, 50));
  assert.deepEqual([town.food, town.xp], [75, 10]);
  assert.deepEqual(brought.command, { cmd: "assist_receive", args: [0, 5] });
  assert.deepEqual(cartMet(town, "77"), { cmd: "clean_received_assists", args: ["77", 0] });
});
