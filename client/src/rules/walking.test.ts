import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import { unitPoint } from "./geometry.ts";
import type { PlacedItem, Town } from "./town.ts";
import { DIRECTION, canWalk, directionTo, findPath, isWalkable, lookAround, stepTowards, unitMoved, walkGrid } from "./walking.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "House", isUnit: false, art: "casa1", width: 2, height: 2, category: 1, subcategory: 111,
    flying: false, velocity: 0, capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0, cost: 30, costType: "w", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h",
    life: 0, attack: 0, defense: 1, attackRange: 0, attackInterval: 0, size: 1, elevation: 1, groups: "", ...fields };
}

function placed(fields: Partial<ItemInfo>, tx: number, ty: number): PlacedItem {
  return { item: item(fields), tx, ty, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
}

const VILLAGER = { id: 500, isUnit: true, width: 1, height: 1, velocity: 3, category: 7, subcategory: 71 };

function town(items: PlacedItem[] = [], expansions = [13]): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 5, gold: 100, wood: 100, food: 100, stone: 100,
    race: "h", skin: 0, expansions: new Set(expansions), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("bought land can be walked on, except under buildings; fields and units are no obstacle", () => {
  const grid = walkGrid(town([placed({}, 45, 45), placed({ subcategory: 122, width: 3, height: 3 }, 50, 50), placed(VILLAGER, 42, 42)]));
  assert.equal(isWalkable(grid, 41, 41), true);
  assert.equal(isWalkable(grid, 44, 45), false);  // under the house (44-45, 44-45)
  assert.equal(isWalkable(grid, 49, 49), true);   // a field
  assert.equal(isWalkable(grid, 42, 42), true);   // where a unit stands
  assert.equal(isWalkable(grid, 39, 40), false);  // block 12, not bought
});

test("a path goes round buildings, diagonally where it can, and ends on the tile asked for", () => {
  const grid = walkGrid(town());
  const straight = findPath(grid, { x: 41, y: 41 }, { x: 45, y: 45 });
  assert.deepEqual(straight, [{ x: 42, y: 42 }, { x: 43, y: 43 }, { x: 44, y: 44 }, { x: 45, y: 45 }]);

  // A wall of houses from y 40 to 49 at x 44-45, with a gap at y 50-51.
  const walls = [40, 42, 44, 46, 48].map((y) => placed({}, 45, y + 1));
  const blocked = walkGrid(town(walls));
  const path = findPath(blocked, { x: 42, y: 45 }, { x: 48, y: 45 })!;
  assert.deepEqual(path.at(-1), { x: 48, y: 45 });
  assert.ok(path.every((tile) => isWalkable(blocked, tile.x, tile.y)), "every tile on the way is free");
  assert.ok(path.some((tile) => tile.y >= 50), "it goes round the end of the wall");
});

test("no squeezing past a corner, and no way into closed land", () => {
  // Two houses touching at a corner: (44-45, 44-45) and (46-47, 42-43).
  const grid = walkGrid(town([placed({}, 45, 45), placed({}, 47, 43)]));
  const path = findPath(grid, { x: 45, y: 43 }, { x: 46, y: 44 })!;
  assert.ok(path.length > 1, `it walks round instead of slipping between the corners: ${JSON.stringify(path)}`);
  assert.equal(findPath(grid, { x: 41, y: 41 }, { x: 30, y: 30 }), null);  // block 7, not bought
  assert.equal(findPath(grid, { x: 41, y: 41 }, { x: 45, y: 45 }), null);  // into a house
  assert.deepEqual(findPath(grid, { x: 41, y: 41 }, { x: 41, y: 41 }), []);
});

test("flying units go straight, over anything", () => {
  const grid = walkGrid(town([placed({}, 43, 43)]));
  assert.deepEqual(findPath(grid, { x: 41, y: 41 }, { x: 44, y: 44 }, true), [{ x: 42, y: 42 }, { x: 43, y: 43 }, { x: 44, y: 44 }]);
});

test("a unit faces where it's going: left or right, then up or down, on the screen", () => {
  const here = unitPoint(50, 50);
  assert.equal(directionTo(here, unitPoint(51, 50), DIRECTION.down), DIRECTION.downRight);  // x + 1: right and down
  assert.equal(directionTo(here, unitPoint(50, 51), DIRECTION.down), DIRECTION.downLeft);
  assert.equal(directionTo(here, unitPoint(49, 49), DIRECTION.down), DIRECTION.up);
  assert.equal(directionTo(here, unitPoint(51, 49), DIRECTION.down), DIRECTION.right);
  assert.equal(directionTo(here, { x: here.x + 10, y: here.y + 5 }, DIRECTION.left), DIRECTION.left);  // too close to turn
});

test("walking: velocity pixels a frame, at 30 frames a second, along the longer axis", () => {
  // A villager (3) for 100 ms: 9 pixels along x, half that along y.
  assert.deepEqual(stepTowards({ x: 0, y: 0 }, { x: 54, y: 27 }, 3, 100), { x: 9, y: 4.5 });
  assert.deepEqual(stepTowards({ x: 0, y: 0 }, { x: 54, y: 27 }, 3, 1000), { x: 54, y: 27 });  // not past it
});

test("standing units look around now and then", () => {
  const unit = placed(VILLAGER, 50, 50);
  assert.equal(lookAround(unit, DIRECTION.down, () => 0.5), null);  // 96% of the time, nothing
  const rolls = [0.01, 1, 0.5];  // turns, towards x + 1, y + 0
  assert.equal(lookAround(unit, DIRECTION.down, () => rolls.shift()!), DIRECTION.downRight);
});

test("only the player's own walk; the save hears where they stopped", () => {
  const t = town();
  const villager = placed(VILLAGER, 44, 46);
  assert.equal(canWalk(t, villager), true);
  assert.equal(canWalk(t, placed({ ...VILLAGER, race: "n" }, 44, 46)), false);  // a wild cow
  assert.equal(canWalk(t, placed({}, 44, 46)), false);  // a house
  assert.deepEqual(unitMoved(t, villager, { x: 41, y: 41 }).args, [41, 41, 500, 44, 46, 0, 0, "Unitat"]);
});
