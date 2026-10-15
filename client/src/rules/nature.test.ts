import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem, type ItemInfo } from "./config.ts";
import { onWildRing } from "./editing.ts";
import { expansionOf } from "./geometry.ts";
import { growBack, nearestFree } from "./nature.ts";
import type { PlacedItem, Town } from "./town.ts";

const config = (id: number, name: string, subcat: number): ConfigItem => ({
  id: String(id), name, type: "b", img_name: "x", width: "1", height: "1", category_id: "6",
  subcat_functional: String(subcat), unit_capacity: "4", activation: "4", collect: "20", collect_type: "w", collect_xp: "1",
  race: "n",
});
const ITEMS = new Map<number, ItemInfo>([
  ...[19, 20, 21].map((id) => [id, itemInfo(config(id, "Tree", 125))] as const),
  ...[69, 70, 71, 72].map((id) => [id, itemInfo(config(id, "Stone", 126))] as const),
  ...[73, 74, 75, 76].map((id) => [id, itemInfo(config(id, "Gold", 127))] as const),
  ...[80, 81].map((id) => [id, itemInfo(config(id, "Regenerating", 128))] as const),
]);
const GOLD = [73, 74, 75, 76], STONE = [69, 70, 71, 72], TREES = [19, 20, 21];

/** The same "random" numbers every run. */
function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function town(things: [number, number, number][] = []): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(),
    items: things.map(([id, tx, ty]): PlacedItem => ({ item: ITEMS.get(id)!, tx, ty, orientation: 0, unitsInside: 0, startedAt: 0, workTime: 0 })),
    unknown: [] };
}

test("a new town: three clumps of gold and of stone, ten of trees, and single trees up to a hundred", () => {
  const t = town([[19, 43, 54], [19, 44, 54]]);
  const { commands, added } = growBack(t, ITEMS, 1000, { random: seeded() });
  const of = (ids: number[]) => added.filter((p) => ids.includes(p.item.id)).length;
  // A clump is 5 or 6 rocks (the size picked once per kind), 16 to 19 trees.
  assert.ok([15, 18].includes(of(GOLD)), `gold: ${of(GOLD)}`);
  assert.ok([15, 18].includes(of(STONE)), `stone: ${of(STONE)}`);
  assert.ok(of(TREES) >= 10 * 16 + 90 && of(TREES) <= 10 * 19 + 98, `trees: ${of(TREES)}`);
  // One to a tile, on the map; in the wild ring or on land not yet bought, as in the Flash
  // client, a few at most on the player's land (a clump at a block's edge can spill over).
  const tiles = new Set(t.items.map((p) => `${p.tx},${p.ty}`));
  assert.equal(tiles.size, t.items.length, "no two on one tile");
  assert.ok(added.every((p) => p.tx >= 0 && p.ty >= 0 && p.tx < 100 && p.ty < 100));
  const theirs = added.filter((p) => !onWildRing(p.tx, p.ty) && expansionOf(p.tx, p.ty) === 13).length;
  assert.ok(theirs < 0.05 * added.length, `${theirs} of ${added.length} on their land`);
  // Bought for nothing, as the Flash client tells the server.
  assert.equal(commands.length, added.length);
  assert.deepEqual(commands[0].args.slice(3), [0, 0, 1, 1, "b"]);
  assert.equal(t.items.length, 2 + added.length);
});

test("a town with enough adds nothing; rocks growing back count, the fourth kinds don't", () => {
  const things: [number, number, number][] = [];
  // 180 trees: ten clumps' worth (18 each, on average), and more than a hundred.
  for (let i = 0; i < 180; i++) things.push([19, i % 20, Math.floor(i / 20)]);
  for (let i = 0; i < 18; i++) things.push([80, 20 + i, 10], [81, 20 + i, 11]);
  const t = town(things);
  assert.deepEqual(growBack(t, ITEMS, 1000, { random: seeded() }).added, []);
  // Gold IV doesn't count: 18 of them, and gold still comes.
  const fourth = town([...things.filter(([id]) => id !== 80), ...Array.from({ length: 18 }, (_, i): [number, number, number] => [76, 20 + i, 12])]);
  const { added } = growBack(fourth, ITEMS, 1000, { random: seeded() });
  assert.ok(added.length > 0 && added.every((p) => GOLD.includes(p.item.id)), "only gold is added");
});

test("a clump's next tile: the tile itself, else the nearest ring's tile furthest down the map", () => {
  assert.deepEqual(nearestFree(new Set(), { x: 5, y: 5 }), { x: 5, y: 5 });
  assert.deepEqual(nearestFree(new Set(["5,5"]), { x: 5, y: 5 }), { x: 6, y: 6 });
  assert.deepEqual(nearestFree(new Set(["5,5", "6,6"]), { x: 5, y: 5 }), { x: 5, y: 6 });
});
