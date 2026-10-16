// Placing on a phone (CLIENT.md, "The shop"): a finger can't hover to show
// where a building would go, so its first tap shows it there, see-through,
// and a tap on it buys it; a tap elsewhere shows it there instead. Moving
// works the same way. The save hears only what was placed.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const FARM = 10, FIRST = [55, 58], THERE = [56, 55], MOVED = [58, 56];

export default async function phonePlace({ newPlayer }) {
  const desk = await newPlayer();
  const phone = await desk.onPhone();
  const { page } = phone;
  const tap = async ([tx, ty], up = 15) => {
    const at = phone.screenOf(tx, ty, up);
    await page.touchscreen.tap(at.x, at.y);
    await phone.wait(300);
  };
  const farms = async () => (await phone.saved()).items.filter(([id]) => id === FARM).map(([, x, y]) => `${x},${y}`);

  await page.locator('.menus button[aria-label="Build"]').click();
  await phone.wait(300);
  await phone.press("Resources");
  await phone.card("Farm Land").click();
  await phone.wait(300);
  assert.match(await phone.bar(), /then tap it again/, "the prompt says how");

  // A first tap shows it; another spot moves it; a tap on it buys it.
  await tap(FIRST);
  await tap(THERE);
  await phone.shot("shown");
  assert.deepEqual(await farms(), [], "nothing bought by showing it");
  await tap(THERE);
  await phone.press("Done");
  assert.deepEqual(await farms(), [THERE.join(",")], "bought where it was shown");

  // Moving: the same.
  await phone.select(THERE, "Farm Land");
  await phone.press("Move");
  await tap(MOVED);
  await phone.shot("moving");
  assert.ok(has(await phone.saved(), FARM, THERE), "still where it was");
  await tap(MOVED);
  assert.deepEqual(await farms(), [MOVED.join(",")], "moved where it was shown");
}
