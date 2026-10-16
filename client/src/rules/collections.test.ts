import assert from "node:assert/strict";
import { test } from "node:test";

import { addPiece, harvestLoot, pieceFrame, pieceLines } from "./collections.ts";

/** A random that gives these numbers in turn. */
const rolls = (...numbers: number[]) => () => numbers.shift()!;

test("a harvest's piece: the rarest under 0.5 in 100, rare under 2.5, uncommon under 4, else none", () => {
  assert.deepEqual(harvestLoot("h", rolls(0.004, 0)), { collection: 19, piece: 1 });
  assert.deepEqual(harvestLoot("h", rolls(0.004, 0.99)), { collection: 20, piece: 1 });
  assert.deepEqual(harvestLoot("h", rolls(0.005, 0)), { collection: 16, piece: 1 }, "0.5 is rare already");
  assert.deepEqual(harvestLoot("h", rolls(0.024, 0.99)), { collection: 18, piece: 1 });
  assert.deepEqual(harvestLoot("h", rolls(0.025, 0)), { collection: 1, piece: 1 });
  assert.deepEqual(harvestLoot("h", rolls(0.039, 0.99)), { collection: 15, piece: 1 }, "the Soldier Statue's pedestal last");
  assert.equal(harvestLoot("h", rolls(0.04, 0)), null);
  assert.equal(harvestLoot("h", rolls(0.9, 0)), null);
});

test("never in a troll town", () => {
  assert.equal(harvestLoot("t", rolls(0, 0)), null);
});

test("about 4 harvests in 100 give a piece; the uncommon ones from 46 kinds", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let found = 0;
  const kinds = new Set<string>();
  for (let i = 0; i < 100_000; i++) {
    const piece = harvestLoot("h", random);
    if (piece) {
      found++;
      kinds.add(`${piece.collection}/${piece.piece}`);
    }
  }
  assert.ok(found > 3700 && found < 4300, `${found} in 100,000`);
  assert.equal(kinds.size, 2 + 3 + 46);
});

test("the server hears the piece; its name lines and its place in the game's sheet", () => {
  assert.deepEqual(addPiece({ collection: 3, piece: 4 }), { cmd: "add_collectable", args: [3, 4] });
  assert.deepEqual(pieceLines({ collection: 1, piece: 1 }), { piece: 340, collection: 320 });
  assert.deepEqual(pieceLines({ collection: 19, piece: 1 }), { piece: 430, collection: 338 });
  assert.equal(pieceLines({ collection: 21, piece: 1 }), null);
  assert.deepEqual(pieceFrame({ collection: 3, piece: 4 }), { x: 180, y: 120, width: 60, height: 60 });
});
