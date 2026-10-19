// Mined-out rocks on the player's own land (DECISIONS.md, 19 October 2026):
// a rock growing back no longer blocks building there. A building bought
// over one, or moved onto one, clears it first; the bulldozer takes one at
// once. Its card says so. The server's save loses each rock as it goes.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const REGROWING_STONE = 81, REGROWING_GOLD = 80, FARM = 10, HOUSE = 1;
const UNDER_FARM = [47, 55], UNDER_HOUSE = [53, 57], BULLDOZED = [56, 57];
const HOUSE_FROM = [44, 52];

export default async function minedOut({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  // Three rocks mined out on the player's land: what a harvest leaves (`buy`, facing 1).
  await player.send([
    { cmd: "buy", args: [REGROWING_STONE, ...UNDER_FARM, 1, 0, 1, 1] },
    { cmd: "buy", args: [REGROWING_GOLD, ...UNDER_HOUSE, 1, 0, 1, 1] },
    { cmd: "buy", args: [REGROWING_STONE, ...BULLDOZED, 1, 0, 1, 1] },
  ]);
  await player.reload();

  // Its card: how long it has left, and that it can be cleared.
  await player.select(UNDER_FARM, "Regenerating stone");
  const card = await player.bar();
  assert.match(card, /Grows back in .+\. Build over it, or bulldoze it, to clear the ground/, `the card says so: ${card}`);
  await player.shot("card");
  await page.keyboard.press("Escape");

  // A farm bought over the first: it fits (a green footprint), and goes down.
  await player.press("Build");
  await player.press("Resources");
  await player.card("Farm Land").click();
  await player.wait(300);
  await player.hover(UNDER_FARM);
  await player.shot("placing");
  await player.tapTile(UNDER_FARM);
  await player.press("Done");

  // A house moved onto the second.
  await player.select(HOUSE_FROM, "House I");
  await player.press("Move");
  await player.hover(UNDER_HOUSE);
  await player.tapTile(UNDER_HOUSE);
  await player.press("Close");

  // The bulldozer takes the third at once: it cost nothing, so nothing to ask.
  const third = await player.select(BULLDOZED, "Regenerating stone");
  await page.keyboard.press("Escape");
  await player.bulldoze(third.point, null);
  await player.shot("cleared");

  const map = await player.saved();
  assert.ok(!has(map, REGROWING_STONE, UNDER_FARM), "the rock under the farm is cleared");
  assert.ok(has(map, FARM, UNDER_FARM), "the farm stands there");
  assert.ok(!has(map, REGROWING_GOLD, UNDER_HOUSE), "the rock under the house is cleared");
  assert.ok(has(map, HOUSE, UNDER_HOUSE) && !has(map, HOUSE, HOUSE_FROM), "the house moved onto it");
  assert.ok(!has(map, REGROWING_STONE, BULLDOZED), "the bulldozed rock is gone");

  // And so it stays.
  await player.reload();
  await player.select(UNDER_FARM, "Farm Land");
  await player.shot("reloaded");
}
