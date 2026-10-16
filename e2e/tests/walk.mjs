// Units walking (CLIENT.md, "Units walking"): a new town's Light Knight is
// selected and sent across the island, round the town hall; it walks there
// and the save hears where it stopped, with the Flash client's command.
// Land not yet bought can be walked on too, as in the Flash client, and
// tapping a building still selects it.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const KNIGHT = 512, FROM = [50, 44], TO = [54, 55], CLOSED = [50, 61];

export default async function walk({ newPlayer }) {
  const player = await newPlayer();
  const arrived = (at) => player.page.waitForFunction(([id, x, y]) =>
    window.seHome.parts.town.items.some((p) => p.item.id === id && p.tx === x && p.ty === y),
  [KNIGHT, ...at], { timeout: 15_000 });

  const knight = await player.select(FROM, "Light Knight");
  assert.match(knight.text, /Tap the ground where it should go/);
  const destination = player.screenOf(...TO);
  assert.ok(await player.page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === "CANVAS", destination),
    "the walk destination is visible above the card");
  await player.tapTile(TO);
  await player.wait(700);
  await player.shot("walking");
  // Still selected while it walks; it isn't there yet.
  assert.match(await player.bar(), /^Light Knight/);

  // Across the island, round the town hall: wait for its game-time walk.
  // The save assertions still check the command sent when it stops.
  await arrived(TO);
  await player.shot("arrived");
  const saved = await player.saved();
  assert.ok(has(saved, KNIGHT, TO), "the save has the knight where it stopped");
  assert.ok(!has(saved, KNIGHT, FROM), "and not where it was");

  // Land not bought (block 18): it walks there too.
  await player.tapTile(CLOSED);
  await arrived(CLOSED);
  assert.ok(has(await player.saved(), KNIGHT, CLOSED), "the knight is on land not yet bought");

  // Tapping a building with a unit selected selects the building.
  await player.select([51, 47], "Tower I");
  await player.press("Close");

  // Reloaded, the knight is where it stopped.
  await player.reload();
  await player.select(CLOSED, "Light Knight");
}
