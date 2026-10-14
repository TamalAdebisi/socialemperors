// Editing a new town: turn a tower, move and sell houses, store a tower, and
// the original's rules (trees and the town hall can't be sold). The server's
// save must change the same way.

import assert from "node:assert/strict";
import { has, stored } from "../lib.mjs";

const TOWER = 29, HOUSE = 1, TREE = 19;

export default async function edit({ newPlayer }) {
  const player = await newPlayer();

  await player.select([51, 47], "Tower I");
  await player.press("Turn");
  await player.press("Close");

  await player.select([44, 50], "House I");
  await player.press("Move");
  await player.hover([47, 57]);
  await player.shot("moving");
  await player.tapTile([47, 57]);
  await player.press("Close");

  // A tree: a villager cuts it; it can't be sold.
  await player.select([50, 58], "Tree");
  assert.deepEqual((await player.barButtons()).filter((label) => /Sell|Remove|Store/.test(label)), [], "a tree offers no Sell, Remove or Store");
  await player.press("Close");

  // Selling asks first.
  await player.select([44, 52], "House I");
  await player.press("Sell");
  assert.match(await player.bar(), /Sell/, "selling asks to confirm");
  await player.press("Sell");

  await player.select([59, 49], "Tower I");
  await player.press("Store");

  // The town hall moves and turns, but can't be stored or sold.
  await player.select([52, 52], "Town Hall");
  const hall = await player.barButtons();
  assert.ok(hall.includes("Move") && hall.includes("Turn"), `the town hall can move and turn: ${hall}`);
  assert.ok(!hall.some((label) => /Sell|Store/.test(label)), `the town hall can't be sold or stored: ${hall}`);
  await player.shot("after");

  const map = await player.saved();
  const items = map.items.map((item) => item.slice(0, 4).join(","));
  assert.ok(items.includes(`${TOWER},51,47,1`), "the tower is turned");
  assert.ok(has(map, HOUSE, [47, 57]) && !has(map, HOUSE, [44, 50]), "the house moved");
  assert.ok(has(map, TREE, [50, 58]), "the tree is still there");
  assert.ok(!has(map, HOUSE, [44, 52]), "the other house is sold");
  assert.ok(!has(map, TOWER, [59, 49]) && stored(map.store, TOWER) === 1, "the second tower is in storage");

  await player.reload();
  await player.shot("reloaded");
}
