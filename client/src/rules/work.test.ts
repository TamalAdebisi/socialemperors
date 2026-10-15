import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";
import {
  canGoInside, canHarvest, freeTileNear, goInside, goldMultiplier, harvestSeconds, harvested, letAllOut, letOut, nextResources, regrow, standingTile,
} from "./work.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House", isUnit: false, art: "casa1", width: 1, height: 1, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0, cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", ...fields };
}

const VILLAGER = item({ id: 500, name: "Villager I", isUnit: true, velocity: 3, subcategory: 71 });
const KNIGHT = item({ id: 512, name: "Light Knight", isUnit: true, velocity: 5, subcategory: 77 });
const CATAPULT = item({ id: 530, name: "Catapult", isUnit: true, velocity: 2, subcategory: 81 });
const TREE = item({ id: 19, name: "Tree", subcategory: 125, activation: 3.24, collect: 20, collectType: "w", collectXp: 1, race: "n", capacity: 4 });
const STONE = item({ id: 69, name: "Stone", subcategory: 126, activation: 6.48, collect: 10, collectType: "s", collectXp: 1, race: "n" });
const GOLD = item({ id: 73, name: "Gold", subcategory: 127, activation: 6.48, collect: 10, collectType: "g", collectXp: 1, race: "n" });
const REGROWING_STONE = item({ id: 81, name: "Regenerating stone", subcategory: 128, activation: 10800, race: "n" });
const MINE = item({ id: 13, name: "Gold Mine I", subcategory: 124, width: 2, height: 2, capacity: 1 });
const REFUGE = item({ id: 151, name: "Small Refuge", subcategory: 1311, width: 2, height: 2, capacity: 2, race: "a" });
const ITEMS = new Map([VILLAGER, KNIGHT, TREE, STONE, GOLD, REGROWING_STONE, item({ id: 70, name: "Stone 2", subcategory: 126 })].map((i) => [i.id, i]));

function placed(what: ItemInfo, tx: number, ty: number, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: what, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, ...more };
}

function town(items: PlacedItem[] = [], level = 1): Town {
  return { id: 0, name: "", townName: "", level, xp: 0, cash: 5, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("villagers work trees, stone and gold; into mills, mines and farms; anyone into a refuge", () => {
  assert.equal(canHarvest(VILLAGER, TREE), true);
  assert.equal(canHarvest(KNIGHT, TREE), false);
  const t = town();
  const mine = placed(MINE, 50, 50);
  assert.equal(canGoInside(t, VILLAGER, mine), true);
  assert.equal(canGoInside(t, KNIGHT, mine), false);
  assert.equal(canGoInside(t, KNIGHT, placed(REFUGE, 45, 45)), true);
  assert.equal(canGoInside(t, CATAPULT, placed(REFUGE, 45, 45)), true, "siege engines too, as in the Flash client");
  const altar = item({ id: 225, name: "Sacrifice Altar", subcategory: 124, capacity: 1 });
  assert.equal(canGoInside(t, VILLAGER, placed(altar, 47, 47)), false, "the altar: in the classic game for now");
  assert.equal(canGoInside(t, VILLAGER, placed(MINE, 50, 50, { unitsInside: 1 })), false, "full");
  assert.equal(canGoInside(t, VILLAGER, placed(MINE, 50, 50, { ruined: true })), false, "burnt out in a raid");
});

test("a unit stands on the free tile beside the thing nearest to it", () => {
  const villager = placed(VILLAGER, 44, 44);
  const tree = placed(TREE, 47, 47);
  const t = town([villager, tree, placed(KNIGHT, 46, 46)]);
  assert.deepEqual(standingTile(t, villager, tree), { x: 46, y: 47 }, "next to it, not where the knight stands");
});

test("a tree takes 4 seconds, a rock 7; gold gives more with the level", () => {
  assert.equal(harvestSeconds(TREE), 4);
  assert.equal(harvestSeconds(STONE), 7);
  // The Forestry Academy makes trees quick, the Minery Academy rocks.
  const forestry = town([placed(item({ id: 223, name: "Forestry Academy", subcategory: 139 }), 60, 60)]);
  assert.deepEqual([harvestSeconds(TREE, forestry), harvestSeconds(STONE, forestry)], [1, 7]);
  const minery = town([placed(item({ id: 222, name: "Minery Academy", subcategory: 139 }), 60, 60)]);
  assert.deepEqual([harvestSeconds(TREE, minery), harvestSeconds(STONE, minery), harvestSeconds(GOLD, minery)], [4, 1, 1]);
  assert.deepEqual([1, 10, 11, 15, 16, 21, 26, 60].map(goldMultiplier), [1, 1, 2, 2, 3, 4, 5, 5]);
});

test("a tree cut: wood and experience, it goes, and the server hears as the Flash client tells it", () => {
  const tree = placed(TREE, 47, 47);
  const t = town([tree]);
  const done = harvested(t, tree, 2, 1000, ITEMS);
  assert.equal(t.wood, 20);
  assert.equal(t.xp, 1);
  assert.equal(t.items.length, 0);
  assert.equal(done.regrowing, null);
  assert.deepEqual(done.commands, [
    { cmd: "collect_new", args: [47, 47, 0, 19, 2, 1, 0] },
    { cmd: "sell", args: [47, 47, 19, 0, 0, "HARV"] },
  ]);
});

test("a rock mined leaves one growing back, which becomes a new rock after three hours", () => {
  const rock = placed(STONE, 47, 47);
  const t = town([rock]);
  const done = harvested(t, rock, 1, 1000, ITEMS);
  assert.equal(t.stone, 10);
  assert.equal(done.regrowing?.item.id, 81);
  assert.deepEqual(done.commands[2], { cmd: "buy", args: [81, 47, 47, 1, 0, 0, 1, "b"] });
  assert.equal(regrow(t, done.regrowing!, 1000 + 10799, ITEMS), null, "not yet");
  const grown = regrow(t, done.regrowing!, 1000 + 10800, ITEMS, () => 0.3)!;
  assert.equal(grown.rock.item.id, 70);  // one of the four kinds, by chance
  assert.deepEqual(t.items, [grown.rock]);
  assert.deepEqual(grown.commands, [
    { cmd: "sell", args: [47, 47, 81, 0, 0, "REGEN"] },
    { cmd: "buy", args: [70, 47, 47, 1, 0, 0, 1, "b"] },
  ]);
});

test("gold mined at level 16 gives three times as much", () => {
  const rock = placed(GOLD, 47, 47);
  const t = town([rock], 16);
  const done = harvested(t, rock, 1, 1000, ITEMS);
  assert.equal(t.gold, 30);
  assert.deepEqual(done.commands[0].args, [47, 47, 0, 73, 1, 3, 0]);
});

test("after one, the next touching it, and those touching them, nearest first; not those being worked", () => {
  const trees = [placed(TREE, 51, 50), placed(TREE, 52, 50), placed(TREE, 53, 51), placed(TREE, 56, 50), placed(STONE, 49, 50)];
  const t = town(trees);
  const next = nextResources(t, { x: 50, y: 50 }, 125, () => false);
  assert.deepEqual(next.map((p) => p.tx), [51, 52, 53], "the chain, not the lone tree or the rock");
  assert.deepEqual(nextResources(t, { x: 50, y: 50 }, 125, (p) => p.tx === 51).map((p) => p.tx), [52, 53]);
});

test("into a building: it starts working with its first worker; out again beside it", () => {
  const villager = placed(VILLAGER, 44, 44);
  const mine = placed(MINE, 50, 50, { startedAt: 5 });
  const t = town([villager, mine]);
  assert.deepEqual(goInside(t, villager, mine, { x: 41, y: 41 }, 1000).args, [41, 41, 500, 50, 50, 0]);
  assert.equal(mine.unitsInside, 1);
  assert.deepEqual(mine.units, [500]);
  assert.equal(mine.startedAt, 1000);
  assert.equal(t.items.includes(villager), false);

  const out = letOut(t, mine, ITEMS)!;
  assert.equal(mine.unitsInside, 0);
  assert.equal(out.unit.item.id, 500);
  assert.deepEqual(out.commands[0].args.slice(0, 4), [50, 50, 0, 500]);
  assert.equal(mine.startedAt, null, "the last one out ends its work");
  assert.equal(Math.max(Math.abs(out.unit.tx - 50), Math.abs(out.unit.ty - 50)), 1, "beside the building's corner");
  assert.equal(letOut(t, mine, ITEMS), null, "nobody left");
});

test("the last worker out of a mill or mine whose time is chosen: the choice goes, and it asks again", () => {
  const chosenMine = item({ id: 13, name: "Gold Mine I", subcategory: 124, width: 2, height: 2, capacity: 2,
    production: { kind: "chosen", seconds: 0, amount: 200, resource: "gold", xp: 7, farm: false } });
  const mine = placed(chosenMine, 50, 50, { unitsInside: 2, units: [500, 500], startedAt: 5, workTime: 3 });
  const t = town([mine]);
  const first = letOut(t, mine, ITEMS)!;
  assert.deepEqual(first.commands.map((c) => c.cmd), ["pop_unit"], "one still works: nothing changes");
  assert.deepEqual([mine.workTime, mine.startedAt], [3, 5]);
  const last = letOut(t, mine, ITEMS)!;
  assert.deepEqual(last.commands.map((c) => c.cmd), ["pop_unit", "activate"]);
  assert.deepEqual(last.commands[1].args, [50, 50, 0, 13, 0]);
  assert.deepEqual([mine.workTime, mine.startedAt], [0, null]);
});

test("everybody out before a building goes", () => {
  const refuge = placed(REFUGE, 50, 50, { unitsInside: 2, units: [512, 500] });
  const t = town([refuge]);
  const out = letAllOut(t, refuge, ITEMS);
  assert.deepEqual(out.map((o) => o.unit.item.id), [500, 512]);
  assert.notDeepEqual([out[0].unit.tx, out[0].unit.ty], [out[1].unit.tx, out[1].unit.ty], "each on a tile of its own");
});

test("a unit comes out on the first ring round the building with a free tile, the one furthest down the map", () => {
  const mine = placed(MINE, 50, 50);  // tiles 49-50
  assert.deepEqual(freeTileNear(town([mine]), mine), { x: 51, y: 51 });
  // That one taken: the next nearest the far corner on the same ring (two are as near; the original's sort may give either).
  const next = freeTileNear(town([mine, placed(VILLAGER, 51, 51)]), mine)!;
  assert.ok([[51, 50], [50, 51]].some(([x, y]) => next.x === x && next.y === y), `${next.x}, ${next.y}`);
  // Anywhere on the map, bought land or not, as in the Flash client.
  const edge = placed(MINE, 59, 59);
  assert.deepEqual(freeTileNear(town([edge]), edge), { x: 60, y: 60 });
});
