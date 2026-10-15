import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { levelUps, readLevels, unlockedAt } from "./levels.ts";
import type { Town } from "./town.ts";

// The start of the game config's table.
const LEVELS = readLevels([
  { name: "Slave", exp_required: 0, reward_type: "s", reward_amount: 50 },
  { name: "Servant", exp_required: 29, reward_type: "w", reward_amount: 50 },
  { name: "Peon", exp_required: 60, reward_type: "f", reward_amount: 50 },
  { name: "Peasant", exp_required: 100, reward_type: "w", reward_amount: 400 },
]);

function town(level: number, xp: number): Town {
  return { id: 0, name: "", townName: "", level, xp, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set(), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
}

test("enough experience for the next level: up one, with its prize", () => {
  const t = town(1, 29);
  assert.deepEqual(levelUps(t, LEVELS), {
    commands: [{ cmd: "rt_level_up", args: [2] }],
    reached: [{ level: 2, name: "Servant", prize: { resource: "wood", amount: 50 } }],
  });
  assert.deepEqual([t.level, t.wood], [2, 50]);
});

test("not enough: nothing", () => {
  const t = town(2, 59);
  assert.deepEqual(levelUps(t, LEVELS), { commands: [], reached: [] });
  assert.equal(t.level, 2);
});

test("enough for several: one at a time, each paid", () => {
  const t = town(1, 150);
  const { commands } = levelUps(t, LEVELS);
  assert.deepEqual(commands.map((c) => c.args[0]), [2, 3, 4]);
  assert.deepEqual([t.level, t.wood, t.food], [4, 450, 50]);
});

test("the last level is the last", () => {
  const t = town(4, 10_000);
  assert.deepEqual(levelUps(t, LEVELS).reached, []);
});

test("the level-up window's new buildings: first sold at that level, in the shop, the town's people's, four at most", () => {
  const item = (id: number, fields: Partial<ConfigItem>) => itemInfo({
    id: String(id), name: `Item ${id}`, type: "b", img_name: "x", width: "2", height: "2", category_id: "1",
    subcat_functional: "111", race: "h", min_level: "7", in_store: "1", ...fields,
  } as ConfigItem);
  const items = [
    item(1, {}), item(2, { min_level: "8" }), item(3, { type: "u" }), item(4, { in_store: "0" }),
    item(5, { race: "t" }), item(6, {}), item(7, {}), item(8, {}), item(9, {}),
  ];
  assert.deepEqual(unlockedAt(items, 7, "h").map((i) => i.id), [1, 6, 7, 8]);
  assert.deepEqual(unlockedAt(items, 7, "t").map((i) => i.id), [5]);
  assert.deepEqual(unlockedAt(items, 9, "h"), []);
});
