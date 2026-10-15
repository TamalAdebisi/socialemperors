import assert from "node:assert/strict";
import { test } from "node:test";

import { seededRandom } from "./battle.ts";
import { campOfScriptedChest, cornerOf, guardsBox, oldCampState, scriptedCamp, scriptedHere, tilePieces } from "./scripted.ts";

test("eighteen scripted camps, every piece in a corner of the map", () => {
  for (const id of [7, ...Array.from({ length: 17 }, (_, i) => 13 + i)]) {
    const camp = scriptedCamp(id);
    assert.ok(camp, `camp ${id}`);
    for (const tile of [...camp.tiles, ...camp.bossTiles]) {
      for (const [, x, y] of tile.pieces) {
        assert.ok(cornerOf(x, y) || (id === 23 && x === 82 && y === 12), `camp ${id}: (${x}, ${y}) in a corner`);
      }
    }
  }
  assert.equal(scriptedCamp(9), null, "nobody ever reaches 9 and 11");
});

test("the burning mill: three guarded wells and the mill; soldiers picked for the level", () => {
  const mill = scriptedCamp(7)!;
  const keys = mill.tiles.flatMap((t) => t.pieces.filter((p) => p[4] === "key"));
  assert.deepEqual(keys.map(([id, x, y]) => [id, x, y]), [[210, 11, 11], [210, 11, 91], [210, 91, 91]]);
  assert.equal(campOfScriptedChest(211), 7);
  const pieces = mill.tiles.flatMap((t) => tilePieces(t, 12, "h", seededRandom(1)));
  const soldiers = pieces.filter((p) => p.role === "unit");
  assert.equal(soldiers.length, 9);
  assert.ok(soldiers.every((s) => [525, 526, 527, 530].includes(s.id)), "troll soldiers up to level 12");
  const inBox = guardsBox({ x: 11, y: 11 });
  assert.ok(inBox(4, 4) && inBox(17, 17) && !inBox(18, 11) && !inBox(11, 3));
});

test("the skeleton statue: humans and trolls; three statues, a wave of five, the chest", () => {
  const statue = scriptedCamp(13)!;
  assert.ok(scriptedHere(13, "h") && scriptedHere(13, "t"));
  assert.ok(scriptedHere(7, "h") && !scriptedHere(7, "t"));
  assert.ok(scriptedHere(14, "t") && !scriptedHere(15, "t"), "trolls get 13 and 14");
  assert.equal(statue.bossTiles[0].pieces.length, 5);
  assert.deepEqual(statue.bossTiles[0].pieces.map(([id, x, y]) => [id, x, y]), [[558, 92, 90], [559, 92, 89], [558, 92, 88], [559, 92, 87], [558, 92, 86]]);
  assert.ok(statue.keepIds);
});

test("how far an old camp has got, from what stands", () => {
  assert.equal(oldCampState(0, 0, 3), "none");
  assert.equal(oldCampState(1, 3, 3), "keys");
  assert.equal(oldCampState(1, 1, 3), "keys");
  assert.equal(oldCampState(1, 0, 3), "enders");
  assert.equal(oldCampState(0, 2, 3), "error");
});
