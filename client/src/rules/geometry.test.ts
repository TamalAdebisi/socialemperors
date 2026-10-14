import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import {
  buildingOrigin,
  buildingPoint,
  depth,
  expansionOf,
  groundBlocks,
  mapArea,
  skinColour,
  terrainItemId,
  tileAt,
  tileUnder,
  unitFacing,
  unitPoint,
} from "./geometry.ts";

function item(fields: Partial<ItemInfo> = {}): ItemInfo {
  return { id: 1, name: "", isUnit: false, art: "x", width: 1, height: 1, category: 0, subcategory: 0, flying: false, velocity: 0,
    cost: 0, costType: "g", facings: 2, production: null,
    inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0, isNew: false, xp: 0, race: "h", ...fields };
}

test("one tile along x is 54 px right and 27 down; along y, 54 left and 27 down", () => {
  const a = buildingPoint(52, 52);
  assert.deepEqual(buildingPoint(53, 52), { x: a.x + 54, y: a.y + 27 });
  assert.deepEqual(buildingPoint(52, 53), { x: a.x - 54, y: a.y + 27 });
});

test("a unit stands in the middle of its tile, half a tile above a building's point", () => {
  assert.deepEqual(unitPoint(10, 20), { x: buildingPoint(10, 20).x, y: buildingPoint(10, 20).y - 27 });
});

test("a building's picture sits with its bottom centre on its point", () => {
  // The town hall: 432 x 513, from its top left corner.
  const point = buildingPoint(52, 52);
  assert.deepEqual(buildingOrigin(point, { x: 0, y: 0, w: 432, h: 513 }), { x: point.x - 216, y: point.y - 513 });
  // Half an odd width is rounded down, as the game does.
  assert.equal(buildingOrigin({ x: 0, y: 0 }, { x: 0, y: 0, w: 109, h: 10 }).x, -54);
});

test("tileAt undoes buildingPoint", () => {
  for (const [tx, ty] of [[0, 0], [52, 52], [99, 3], [7, 81]]) {
    assert.deepEqual(tileAt(buildingPoint(tx, ty)), { x: tx, y: ty });
  }
});

test("tileUnder finds the tile a point is on: any point inside its diamond", () => {
  const bottom = buildingPoint(52, 52);
  // Just above the bottom corner, the middle, and near the top corner of tile 52, 52.
  for (const dy of [1, 27, 53]) {
    assert.deepEqual(tileUnder({ x: bottom.x, y: bottom.y - dy }), { x: 52, y: 52 });
  }
  // Just below its bottom corner is the next tile down.
  assert.deepEqual(tileUnder({ x: bottom.x, y: bottom.y + 1 }), { x: 53, y: 53 });
});

test("expansions are numbered across then down, from 1; the first town opens the middle one", () => {
  assert.equal(expansionOf(0, 0), 1);
  assert.equal(expansionOf(99, 0), 5);
  assert.equal(expansionOf(0, 20), 6);
  assert.equal(expansionOf(52, 52), 13);
  assert.equal(expansionOf(99, 99), 25);
});

test("the ground: the ring is wild, the middle open where the save says, the rest for sale", () => {
  const blocks = groundBlocks(new Set([13, 14, 1]));
  assert.equal(blocks.length, 25);
  const at = (gx: number, gy: number) => blocks.find((b) => b.gx === gx && b.gy === gy)!;
  assert.deepEqual([at(2, 2).frame, at(2, 2).open], [3, true]);
  assert.deepEqual([at(3, 2).frame, at(3, 2).open], [3, true]);
  assert.deepEqual([at(1, 1).frame, at(1, 1).open], [0, false]);
  // Block 1 is in the ring: never open, even if a save lists it.
  assert.deepEqual([at(0, 0).frame, at(0, 0).open], [1, false]);
  // Each block's picture stands on its last tile.
  assert.deepEqual([at(2, 2).tx, at(2, 2).ty], [59, 59]);
});

test("the ground's look and colour follow the island's skin", () => {
  assert.equal(terrainItemId(0), 1000);
  assert.equal(terrainItemId(2), 1002);
  assert.equal(skinColour(0), 0x669c2c);
  assert.equal(skinColour(99), 0x669c2c);
});

test("things further back are drawn first; farms under everything", () => {
  const house = { item: item({ width: 2 }), tx: 52, ty: 52, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
  const behind = { item: item(), tx: 50, ty: 51, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
  const farm = { item: item({ subcategory: 122, width: 2 }), tx: 60, ty: 60, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
  assert.ok(depth(behind) < depth(house));
  assert.ok(depth(farm) < depth(behind));
});

test("units draw five directions and mirror three", () => {
  assert.deepEqual(unitFacing(1), { frame: 0, mirrored: false });
  assert.deepEqual(unitFacing(5), { frame: 4, mirrored: false });
  assert.deepEqual(unitFacing(6), { frame: 1, mirrored: true });
  assert.deepEqual(unitFacing(7), { frame: 2, mirrored: true });
  assert.deepEqual(unitFacing(8), { frame: 3, mirrored: true });
});

test("the map is a diamond 10,800 px wide", () => {
  const area = mapArea();
  assert.equal(area.right - area.left, 10800);
  assert.equal(area.bottom - area.top, 5400);
});
