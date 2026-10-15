// Wild animals (CLIENT.md, "The living map"): a sheep on land not bought yet
// is wild, and its card says how it's caught. A villager sent to it comes
// within 4 tiles and catches it: "Captured!" shows over it, and it walks to
// the sheep ranch and goes in, as the save hears (push_unit).

import assert from "node:assert/strict";
import { itemAt } from "../lib.mjs";

const SHEEP = 505, VILLAGER = 500, SHEEP_RANCH = 11;
// Just off the player's land (40 to 59 each way), on screen; a villager 5 tiles away, out of reach.
const SHEEP_AT = [50, 61], VILLAGER_AT = [50, 56], RANCH_AT = [58, 57];

export default async function animals({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [SHEEP, ...SHEEP_AT, 0, 0, 1, 1, "u"] },
    { cmd: "buy", args: [VILLAGER, ...VILLAGER_AT, 0, 0, 1, 1, "u"] },
    { cmd: "buy", args: [SHEEP_RANCH, ...RANCH_AT, 0, 0, 1, 1, "b"] },
  ]);
  await player.reload();

  const sheep = await player.select(SHEEP_AT, "Sheep");
  assert.match(sheep.text, /In the wild: bring one of your units near to catch it/);
  await player.press("Close");

  // The villager to the sheep: near enough, it's caught, and off it goes to the ranch.
  await player.select(VILLAGER_AT, "Villager I");
  await player.click(sheep.point);
  let saved;
  for (let tries = 0; tries < 6; tries++) {
    saved = await player.saved();
    if ((itemAt(saved, SHEEP_RANCH, RANCH_AT)?.[6] ?? []).length > 0) break;
    if (tries === 0) await player.shot("caught");
  }
  assert.deepEqual(itemAt(saved, SHEEP_RANCH, RANCH_AT)?.[6], [SHEEP], "the sheep is in the ranch");
  assert.ok(!saved.items.some((i) => i[0] === SHEEP && i[1] > 30 && i[1] < 60 && i[2] > 40 && i[2] < 60), "and no longer on the map");
}
