// Units that used to get stuck (CLIENT.md, "Units walking"): a villager left
// off the bought land (as after a fight at a troll camp, or freed from one)
// walks back onto it when sent; and a wall gate opens for units to pass and
// shuts again, as in the Flash client (its other buttons hidden while open).

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const VILLAGER = 500, GATE = 37;
// Block 18, below the bought one (tiles 40 to 59): not bought.
const OFF_LAND = [50, 61];
const HOME = [53, 57];
const GATE_AT = [58, 55];

export default async function stuck({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [VILLAGER, ...OFF_LAND, 0, 0, 0, 1] },
    { cmd: "buy", args: [GATE, ...GATE_AT, 0, 0, 0, 1] },
  ]);
  await player.reload();

  // Off the land: sent home, it walks there.
  await player.select(OFF_LAND, "Villager I");
  await player.click(player.screenOf(...HOME, 27));
  await player.wait(5000);
  await player.shot("home");
  assert.ok(has(await player.saved(), VILLAGER, HOME), "the villager off the land walked home");

  // The gate: Open door shows it open and hides Move, Turn, Store and Sell; Close door shuts it.
  const gate = await player.select(GATE_AT, "Wall Door");
  const box = { x: Math.round(gate.point.x - 70), y: Math.round(gate.point.y - 60), width: 140, height: 90 };
  const shut = await player.page.screenshot({ clip: box });
  await player.press("Open door");
  await player.wait(500);
  assert.deepEqual((await player.barButtons()).filter((label) => /Move|Turn|Store|Sell|Remove/.test(label)), [], "an open gate can only be shut");
  assert.ok(!(await player.page.screenshot({ clip: box })).equals(shut), "the gate is drawn open");
  await player.shot("gate-open");
  await player.press("Close door");
  await player.wait(500);
  assert.ok((await player.barButtons()).includes("Move"), "shut, its buttons are back");
}
