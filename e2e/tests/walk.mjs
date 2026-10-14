// Units walking (CLIENT.md, "Units walking"): a new town's Light Knight is
// selected and sent across the island, round the town hall; it walks there
// and the save hears where it stopped, with the Flash client's command.
// Closed land is out of reach, and tapping a building still selects it.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const KNIGHT = 512, FROM = [50, 44], TO = [55, 56];

export default async function walk({ newPlayer }) {
  const player = await newPlayer();

  const knight = await player.select(FROM, "Light Knight");
  assert.match(knight.text, /Tap the ground where it should go/);
  await player.tapTile(TO);
  await player.wait(700);
  await player.shot("walking");
  // Still selected while it walks; it isn't there yet.
  assert.match(await player.bar(), /^Light Knight/);

  // Across the island, round the town hall: a few seconds at its speed (5 pixels a frame).
  await player.wait(5000);
  await player.shot("arrived");
  const saved = await player.saved();
  assert.ok(has(saved, KNIGHT, TO), "the save has the knight where it stopped");
  assert.ok(!has(saved, KNIGHT, FROM), "and not where it was");

  // Closed land can't be reached: it says so, and stays put.
  await player.tapTile([50, 61]);  // block 18, not bought
  await player.said(/can't get there/);

  // Tapping a building with a unit selected selects the building.
  await player.select([51, 47], "Tower I");
  await player.press("Close");

  // Reloaded, the knight is where it stopped.
  await player.reload();
  await player.select(TO, "Light Knight");
}
