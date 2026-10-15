import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";
import { applyVillagers, lineUp, nextInLine, townHallLevel, villagers } from "./villagers.ts";

const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "1", name: "Thing", type: "b", img_name: "x", width: "1", height: "1", category_id: "1",
  subcat_functional: "111", unit_capacity: "0", activation: "0", collect: "0", collect_type: "g", collect_xp: "0",
  ...fields,
});
const VILLAGER = itemInfo(config({ id: "500", name: "Villager I", type: "u", subcat_functional: "71", velocity: "3", race: "h" }));
const VILLAGER_F = itemInfo(config({ id: "501", name: "Villager I", type: "u", subcat_functional: "71", velocity: "3", race: "h" }));
const TROLL = itemInfo(config({ id: "580", name: "Mr. Troll", type: "u", subcat_functional: "71", velocity: "3", race: "t" }));
const KNIGHT = itemInfo(config({ id: "2", name: "Light Knight", type: "u", subcat_functional: "73", velocity: "4" }));
const hall = (id: number) => itemInfo(config({ id: String(id), name: "Town Hall", subcat_functional: "135" }));
const ACADEMY = itemInfo(config({ id: "221", name: "Academy" }));
const TREE = itemInfo(config({ id: "60", name: "Tree", subcat_functional: "125" }));

function at(item: ItemInfo, tx = 50, ty = 50): PlacedItem {
  return { item, tx, ty, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0 };
}

function town(things: ItemInfo[], race: "h" | "t" = "h"): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race, skin: 0, expansions: new Set(), unlocked: new Set(), gifts: new Map(), store: new Map(),
    items: things.map((item) => at(item)), unknown: [] };
}

test("the town hall's number: none, then I to IV, trolls' too", () => {
  assert.equal(townHallLevel(town([])), 0);
  assert.deepEqual([26, 139, 140, 141].map((id) => townHallLevel(town([hall(id)]))), [1, 2, 3, 4]);
  assert.deepEqual([289, 321, 322].map((id) => townHallLevel(town([hall(id)], "t"))), [1, 2, 3]);
});

test("villagers walk faster and line up more with a better town hall; the Academy adds 2 to each", () => {
  assert.deepEqual(villagers(town([])), { speed: 3, line: 3, name: "Villager I" });
  assert.deepEqual(villagers(town([hall(26)])), { speed: 5, line: 5, name: "Villager I" });
  assert.deepEqual(villagers(town([hall(139)])), { speed: 5, line: 7, name: "Villager II" });
  assert.deepEqual(villagers(town([hall(140)])), { speed: 6, line: 9, name: "Villager III" });
  assert.deepEqual(villagers(town([hall(141)])), { speed: 6, line: 10, name: "Villager IV" });
  assert.deepEqual(villagers(town([hall(141), ACADEMY])), { speed: 8, line: 12, name: "Villager IV" });
  assert.deepEqual(villagers(town([hall(321)], "t")), { speed: 5, line: 7, name: "Peasant II" });
});

test("the villager items take the speed and name; other units don't", () => {
  const items = new Map([VILLAGER, VILLAGER_F, TROLL, KNIGHT].map((item) => [item.id, { ...item }]));
  const t = town([hall(140)]);
  t.items.push(at(items.get(500)!));
  assert.equal(applyVillagers(t, items), true);
  assert.deepEqual([items.get(500)!.name, items.get(500)!.velocity], ["Villager III", 6]);
  assert.deepEqual([items.get(501)!.name, items.get(501)!.velocity], ["Villager III", 6], "offered for training: named too");
  assert.deepEqual([items.get(580)!.name, items.get(580)!.velocity], ["Mr. Troll", 6], "not in this town: keeps its name");
  assert.deepEqual([items.get(2)!.name, items.get(2)!.velocity], ["Light Knight", 4]);
  assert.equal(applyVillagers(t, items), false, "nothing new");
});

test("a line of trees: tapped ones join the end, up to the room", () => {
  const [a, b, c, d] = [1, 2, 3, 4].map((x) => at(TREE, x, 0));
  const line: PlacedItem[] = [];
  assert.deepEqual(lineUp(line, a, 3, false), { marked: true, goNow: true });
  assert.deepEqual(lineUp(line, b, 3, true), { marked: true, goNow: false }, "busy with a: b waits");
  assert.deepEqual(lineUp(line, c, 3, true), { marked: true, goNow: false });
  assert.equal(lineUp(line, d, 3, true), null, "full");
  assert.deepEqual(lineUp(line, b, 3, true), { marked: false, goNow: false }, "tapped again: to the end");
  assert.deepEqual(line, [a, c, b]);
  assert.deepEqual(lineUp([a, b], c, 3, false), { marked: true, goNow: true }, "not busy: sets off for it");
});

test("after a tree, the next in line that's still there and free", () => {
  const [a, b, c, d] = [1, 2, 3, 4].map((x) => at(TREE, x, 0));
  const line = [a, b, c, d];
  const gone = new Set([b]);
  const takenByAnother = new Set([c]);
  const free = (p: PlacedItem) => !gone.has(p) && !takenByAnother.has(p);
  assert.deepEqual(nextInLine(line, a, free), { next: d, dropped: [b, c] });
  assert.deepEqual(line, [d], "the next stays at the front until it's done");
  assert.deepEqual(nextInLine(line, d, free), { next: null, dropped: [] });
  assert.deepEqual(line, []);
});
