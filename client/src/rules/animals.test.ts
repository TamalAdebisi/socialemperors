import assert from "node:assert/strict";
import { test } from "node:test";

import { ANIMAL, animalsToAdd, canLiveIn, caught, homeFor, markWild } from "./animals.ts";
import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import { growBack } from "./nature.ts";
import type { PlacedItem, Town } from "./town.ts";
import { canWalk } from "./walking.ts";
import { canGoInside } from "./work.ts";

const config = (id: number, name: string, type: string, subcat: number, more: Partial<ConfigItem> = {}): ConfigItem => ({
  id: String(id), name, type, img_name: "x", width: "1", height: "1", category_id: "1",
  subcat_functional: String(subcat), unit_capacity: "0", activation: "0", collect: "0", collect_type: "f", collect_xp: "0",
  race: "n", velocity: type === "u" ? "3" : "0", ...more,
});
const ITEMS = new Map<number, ItemInfo>([
  [505, itemInfo(config(505, "Sheep", "u", ANIMAL.sheep))],
  [504, itemInfo(config(504, "Cow", "u", ANIMAL.cow))],
  [571, itemInfo(config(571, "Horse", "u", ANIMAL.horse))],
  [584, itemInfo(config(584, "Boar", "u", ANIMAL.boar))],
  [500, itemInfo(config(500, "Villager I", "u", 71, { race: "h" }))],
  [11, itemInfo(config(11, "Sheep Ranch I", "b", 123, { race: "h", unit_capacity: "6", width: "3", height: "3" }))],
  [12, itemInfo(config(12, "Cow Ranch I", "b", 123, { race: "h", unit_capacity: "6", width: "3", height: "3" }))],
  [226, itemInfo(config(226, "Nursery", "b", 123, { race: "a", unit_capacity: "3", width: "3", height: "3" }))],
]);

function at(id: number, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: ITEMS.get(id)!, tx, ty, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0, ...more };
}

function town(items: PlacedItem[], more: Partial<Town> = {}): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(),
    items, unknown: [], ...more };
}

test("animals off the player's land are wild as the town opens; on it, theirs", () => {
  const out = at(505, 10, 10), home = at(505, 50, 50), villager = at(500, 45, 45);
  markWild(town([out, home, villager]));
  assert.deepEqual([out.wild, home.wild, villager.wild], [true, false, undefined]);
});

test("how many come: 7 sheep and 7 cows, 6 horses from level 11; boars in a troll town; 20 of a kind a day", () => {
  const sheep = [at(505, 50, 50), at(505, 51, 50)];
  assert.deepEqual(animalsToAdd(town(sheep), {}, 20), [{ kind: ANIMAL.sheep, id: 505, count: 5 }, { kind: ANIMAL.cow, id: 504, count: 7 }]);
  assert.deepEqual(animalsToAdd(town([], { level: 11 }), {}, 20).map((a) => a.id), [505, 504, 571]);
  assert.deepEqual(animalsToAdd(town([], { race: "t" }), {}, 20), [{ kind: ANIMAL.boar, id: 584, count: 7 }]);
  assert.deepEqual(animalsToAdd(town([]), { [ANIMAL.sheep]: 17, [ANIMAL.cow]: 20 }, 20), [{ kind: ANIMAL.sheep, id: 505, count: 3 }]);
});

test("one of the player's units within 4 tiles catches a wild animal; then it walks, and lives in its ranch", () => {
  const wild = at(505, 40, 50, { wild: true });
  const villager = at(500, 44, 50);
  const t = town([wild, villager]);
  assert.equal(canWalk(t, wild), false, "wild: not theirs to send");
  assert.deepEqual(caught(t), [wild], "4 tiles away");
  villager.tx = 44, villager.ty = 51;
  assert.deepEqual(caught(t), [], "just over 4");
  wild.wild = false;
  assert.equal(canWalk(t, wild), true, "caught: theirs");
  const sheepRanch = at(11, 55, 55), cowRanch = at(12, 42, 50);
  t.items.push(cowRanch, sheepRanch);
  assert.equal(homeFor(t, wild), sheepRanch, "its own kind's, even if another is nearer");
  assert.equal(canGoInside(t, wild.item, sheepRanch), true);
  assert.equal(canGoInside(t, wild.item, cowRanch), false);
  assert.equal(canLiveIn(ITEMS.get(504)!, cowRanch.item), true);
});

test("animals grow back with the trees, wild, and the server hears how many came", () => {
  const t = town([]);
  const { commands, added } = growBack(t, ITEMS, 1000, { animals: { today: { [ANIMAL.cow]: 18 }, perDay: 20 } });
  const animals = added.filter((p) => p.item.isUnit);
  assert.deepEqual(animals.map((p) => p.item.id).sort(), [...Array(7).fill(505), 504, 504].sort());
  assert.ok(animals.every((p) => p.wild === true));
  assert.deepEqual(commands.filter((c) => c.cmd === "admin_add_animal").map((c) => c.args), [[ANIMAL.sheep, 7], [ANIMAL.cow, 2]]);
  assert.equal(commands.find((c) => c.cmd === "buy" && c.args[0] === 505)?.args[7], "u");
});

test("the Nursery takes a white cow, sheep, horse or boar, and then only that animal", () => {
  const nursery = ITEMS.get(226)!;
  assert.equal(canLiveIn(ITEMS.get(504)!, nursery), true, "empty: any of the four");
  assert.equal(canLiveIn(ITEMS.get(500)!, nursery), false, "not a villager");
  assert.equal(canLiveIn(ITEMS.get(505)!, nursery, [504]), false, "a cow inside: no sheep");
  assert.equal(canLiveIn(ITEMS.get(504)!, nursery, [504]), true, "another cow");
});
