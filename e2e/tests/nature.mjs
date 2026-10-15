// Trees and rocks grow back (CLIENT.md, "The living map"): a new town has 8
// trees and no rocks, so opening it adds clumps of gold and stone rocks and
// of trees, and single trees, in the wild ring and on the player's land,
// one to a tile. The server keeps them; opening it again adds no more trees.

import assert from "node:assert/strict";

const TREES = [19, 20, 21], GOLD = [73, 74, 75, 76], STONE = [69, 70, 71, 72];

export default async function nature({ newPlayer }) {
  const player = await newPlayer({ wild: true });
  const saved = await player.saved();
  const count = (map, ids) => map.items.filter((i) => ids.includes(i[0])).length;
  const trees = count(saved, TREES);
  assert.ok(trees >= 8 + 10 * 16 + 80, `trees grew: ${trees}`);
  assert.ok([15, 18].includes(count(saved, GOLD)), `three clumps of gold: ${count(saved, GOLD)}`);
  assert.ok([15, 18].includes(count(saved, STONE)), `three clumps of stone: ${count(saved, STONE)}`);
  const tiles = saved.items.filter((i) => [...TREES, ...GOLD, ...STONE].includes(i[0])).map((i) => `${i[1]},${i[2]}`);
  assert.equal(new Set(tiles).size, tiles.length, "one to a tile");
  await player.shot("grown");

  await player.reload();
  const again = await player.saved();
  assert.equal(count(again, TREES), trees, "enough trees now: no more");
}
