import assert from "node:assert/strict";
import { test } from "node:test";

import { addPiece, battleSource, harvestLoot, loot, pieceFrame, pieceLines } from "./collections.ts";

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
  // The Bahamuts': Golden Gem, Red Horns, Black Spikes; Golden, Red, Supreme Heart.
  assert.deepEqual(pieceLines({ collection: 21, piece: 1 }), { piece: 1369, collection: 1385 });
  assert.deepEqual(pieceLines({ collection: 22, piece: 5 }), { piece: 1378, collection: 1384 });
  assert.deepEqual(pieceLines({ collection: 23, piece: 5 }), { piece: 1383, collection: 1386 });
  assert.equal(pieceLines({ collection: 24, piece: 1 }), null);
  assert.deepEqual(pieceFrame({ collection: 3, piece: 4 }), { x: 180, y: 120, width: 60, height: 60 });
});

const TROLL = { id: 580, race: "t", subcategory: 71 };
const SOLDIER = { id: 509, race: "h", subcategory: 78 };
const BOSS = { id: 1110, race: "e", subcategory: 84 };
const CHEST = { id: 82, race: "n", subcategory: 811 };
const PRINCESS = { id: 83, race: "n", subcategory: 811 };
const KRAKEN = { id: 549, race: "e", subcategory: 78 };

test("where a fallen enemy's piece comes from, as the Flash client decides it", () => {
  assert.equal(battleSource("attack", SOLDIER, "h"), "assault", "anything attacking a town");
  assert.equal(battleSource("hardcore", SOLDIER, "h"), "hardcore", "anything on a hardcore or god island");
  assert.equal(battleSource("hardcore", CHEST, "h"), "hardcore");
  assert.equal(battleSource("quest", TROLL, "h"), "mobs", "the enemy's own race: trolls, for a human");
  assert.equal(battleSource("home", TROLL, "h"), "mobs");
  assert.equal(battleSource("quest", KRAKEN, "h"), "mobs", "and the sea monsters");
  assert.equal(battleSource("quest", BOSS, "h"), "boss");
  assert.equal(battleSource("quest", CHEST, "h"), "chest");
  assert.equal(battleSource("quest", SOLDIER, "h"), null, "a human soldier on an island gives none");
  assert.equal(battleSource("quest", PRINCESS, "h"), null, "nor another of the islands' prizes");
});

test("a fight's piece: by its source, the same rarities; a boss or chest always gives one", () => {
  assert.deepEqual(loot("mobs", "h", rolls(0.004, 0)), { collection: 9, piece: 1 }, "the War Troll's, the rarest");
  assert.deepEqual(loot("mobs", "h", rolls(0.03, 0)), { collection: 15, piece: 2 }, "the Soldier Statue's legs, uncommon");
  assert.equal(loot("mobs", "h", rolls(0.04, 0)), null);
  assert.deepEqual(loot("assault", "h", rolls(0.01, 0)), { collection: 7, piece: 1 }, "the Penguin's, rare");
  // A boss or a chest: the roll is out of 2.5, not 100.
  assert.deepEqual(loot("boss", "h", rolls(0.19, 0)), { collection: 9, piece: 5 });
  assert.deepEqual(loot("boss", "h", rolls(0.99, 0.99)), { collection: 18, piece: 5 });
  assert.deepEqual(loot("chest", "h", rolls(0.99, 0)), { collection: 15, piece: 4 });
  assert.equal(loot("boss", "t", rolls(0, 0)), null, "never for a troll town");
});

test("a hardcore or god island: only the Bahamuts' pieces, and half as often", () => {
  assert.deepEqual(loot("hardcore", "h", rolls(0.004, 0.4, 0)), { collection: 23, piece: 1 }, "the Heart's, the rarest");
  assert.deepEqual(loot("hardcore", "h", rolls(0.01, 0.4, 0)), { collection: 21, piece: 1 }, "Golden");
  assert.deepEqual(loot("hardcore", "h", rolls(0.01, 0.4, 0.99)), { collection: 22, piece: 5 }, "or Red");
  assert.equal(loot("hardcore", "h", rolls(0.004, 0.5, 0)), null, "the other half: nothing");
  assert.equal(loot("hardcore", "h", rolls(0.03, 0, 0)), null, "and no uncommon ones");
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const found = { 21: 0, 22: 0, 23: 0 } as Record<number, number>;
  for (let i = 0; i < 200_000; i++) {
    const piece = loot("hardcore", "h", random);
    if (piece) found[piece.collection]++;
  }
  // 1 in 100 rolls Golden or Red, 1 in 400 the Heart: 1,000, 1,000 and 500 in 200,000.
  assert.ok(found[21] > 850 && found[21] < 1150, `${found[21]} Golden`);
  assert.ok(found[22] > 850 && found[22] < 1150, `${found[22]} Red`);
  assert.ok(found[23] > 400 && found[23] < 600, `${found[23]} Heart`);
});

test("every collection's pieces come from somewhere", () => {
  const seen = new Set<string>();
  for (const source of ["harvest", "mobs", "boss", "assault", "chest", "hardcore"] as const) {
    // Out of 100: the rarest, rare, uncommon; out of 2.5 (a boss, a chest): the rarest, rare.
    for (const first of [0.004, 0.01, 0.03, 0.1, 0.5]) {
      for (let pick = 0; pick < 1; pick += 0.01) {
        // Only a hardcore roll takes a number for its half chance, before the pick.
        const piece = loot(source, "h", source === "hardcore" ? rolls(first, 0, pick) : rolls(first, pick));
        if (piece) seen.add(`${piece.collection}/${piece.piece}`);
      }
    }
  }
  assert.equal(seen.size, 23 * 5);
});
