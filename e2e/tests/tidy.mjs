// Tidying a town as it opens (CLIENT.md, "The living map"): a save with a
// house on top of another and a knight standing on it opens with the second
// house in storage and the knight beside it, as the server hears. A town with
// no villager gets one near the middle once Arthur's lessons are skipped.

import assert from "node:assert/strict";
import { stored } from "../lib.mjs";

const HOUSE = 1, KNIGHT = 512, HOUSE_AT = [46, 47], KNIGHT_AT = [45, 46];

export default async function tidy({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [HOUSE, ...HOUSE_AT, 0, 0, 1, 1] },
    { cmd: "buy", args: [HOUSE, ...HOUSE_AT, 0, 0, 1, 1] },
    { cmd: "buy", args: [KNIGHT, ...KNIGHT_AT, 0, 0, 1, 1] },
  ]);
  await player.reload();
  const saved = await player.saved();
  const at = (id, [x, y]) => saved.items.filter((i) => i[0] === id && i[1] === x && i[2] === y).length;
  assert.equal(at(HOUSE, HOUSE_AT), 1, "one house stays");
  assert.equal(stored(saved.store, HOUSE), 1, "the other is in storage");
  assert.equal(at(KNIGHT, KNIGHT_AT), 0, "the knight stepped off the house");
  const knights = saved.items.filter((i) => i[0] === KNIGHT && Math.max(Math.abs(i[1] - 45.5), Math.abs(i[2] - 46.5)) <= 2);
  assert.equal(knights.length, 1, "beside it");

  // A new town has no villager: once the lessons are skipped, it gets one.
  const newcomer = await newPlayer({ wild: true });
  await newcomer.reload();
  const town = await newcomer.saved();
  const villagers = town.items.filter((i) => (i[0] === 500 || i[0] === 501) && Math.abs(i[1] - 54) <= 5 && Math.abs(i[2] - 54) <= 5);
  assert.equal(villagers.length, 1, "a villager near the middle");
}
