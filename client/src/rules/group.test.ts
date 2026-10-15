import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { MAX_SELECTED, sameKindNear, squareTiles } from "./group.ts";
import type { PlacedItem } from "./town.ts";

const unit = (id: number, subcat: number, tx: number, ty: number, range = 1): PlacedItem => ({
  item: itemInfo({
    id: String(id), name: `Unit ${id}`, type: "u", img_name: "u", width: "1", height: "1", category_id: "3",
    subcat_functional: String(subcat), attack_range: String(range),
  } as ConfigItem),
  tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: 0, workTime: 0,
});

test("a double click picks the units of its kind within 10 tiles, nearest first, itself included", () => {
  const villager = unit(500, 71, 50, 50);
  const near = unit(501, 71, 52, 50);
  const nearer = unit(500, 71, 51, 50);
  const far = unit(500, 71, 61, 50);  // 11 tiles
  const corner = unit(500, 71, 56, 58);  // 6 and 8: exactly 10
  const soldier = unit(509, 78, 50, 51);
  assert.deepEqual(sameKindNear(villager, [far, near, soldier, villager, corner, nearer]), [villager, nearer, near, corner]);
});

test("its kind: fighting up close or from afar, healers apart; animals pick nothing", () => {
  const footman = unit(509, 78, 50, 50);
  const cleric = unit(503, 72, 50, 51);
  const healer = unit(502, 72, 50, 52);
  const archer = unit(512, 80, 50, 53, 6);
  const rider = unit(520, 79, 50, 54, 1);
  const horseArcher = unit(521, 79, 50, 55, 5);
  const all = [footman, cleric, healer, archer, rider, horseArcher];
  assert.deepEqual(sameKindNear(footman, all), [footman, cleric, healer, rider], "a healer that fights up close counts too, as in the original");
  assert.deepEqual(sameKindNear(healer, all), [healer], "healers pick healers");
  assert.deepEqual(sameKindNear(archer, all), [archer, horseArcher]);
  assert.deepEqual(sameKindNear(unit(600, 75, 50, 50), all), [], "a sheep: nothing");
});

test("at most 20", () => {
  const many = Array.from({ length: 30 }, (_, i) => unit(500, 71, 50 + (i % 6), 50 + Math.floor(i / 6)));
  assert.equal(sameKindNear(many[0], many).length, MAX_SELECTED);
});

test("a group sent to a tile: a square grown from it, ring by ring, free tiles only", () => {
  const all = () => true;
  assert.deepEqual(squareTiles({ x: 10, y: 20 }, 4, all), [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 21 }, { x: 10, y: 21 }]);
  const nine = squareTiles({ x: 0, y: 0 }, 9, all);
  assert.deepEqual(nine.slice(4), [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }]);
  const taken = new Set(["11,20", "10,21"]);
  assert.deepEqual(squareTiles({ x: 10, y: 20 }, 3, (t) => !taken.has(`${t.x},${t.y}`)),
    [{ x: 10, y: 20 }, { x: 11, y: 21 }, { x: 12, y: 20 }]);
  assert.deepEqual(squareTiles({ x: 10, y: 20 }, 3, () => false), [], "nowhere to stand: nobody goes");
});
