// The pointer's tools, as on the Flash client's bar (CLIENT.md, "The
// pointer's tools"): its button opens a menu. Remove (the bulldozer) asks
// before selling a house, takes a rock at once, leaves the town hall, and
// stays on until the button, now Cancel, puts it down. Fast collect (the
// glove) collects a ready farm it's swept over. The save hears each one.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const HOUSE = [1, 47, 55], ROCK = [69, 53, 57], FARM = [10, 55, 56], VILLAGER = 500, SPOT = [56, 57];
const HALL = [52, 52];

export default async function tools({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "buy", args: [...HOUSE, 0, 0, 1, 1] },
    { cmd: "buy", args: [...ROCK, 0, 0, 1, 1] },
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
    { cmd: "push_unit", args: [...SPOT, VILLAGER, FARM[1], FARM[2], 0] },
  ]);
  const setUpAt = Date.now();
  await player.reload();
  // Where the house and the rock are on the screen (found by selecting them, with the pointer).
  const house = await player.select(HOUSE.slice(1), "House I");
  const rock = await player.select(ROCK.slice(1), "Stone");
  await page.keyboard.press("Escape");

  // The menu, and Remove.
  await page.locator(".pointer-tool").click();
  assert.ok(await page.locator(".tool-menu").isVisible(), "the pointer's button opens its tools");
  await player.shot("menu");
  await page.locator('.tool-menu [data-tool="remove"]').click();
  assert.ok(!(await page.locator(".tool-menu").isVisible()), "chosen: the menu closes");
  assert.equal(await page.locator(".pointer-tool").getAttribute("aria-label"), "Cancel: back to the pointer");

  // The house: asked first. The rock: at once. The town hall: left be.
  await player.click(house.point);
  assert.match(await player.bar(), /^Sell House I for 1 wood\?/);
  await player.press("Sell");
  await player.click(rock.point);
  await player.click(player.screenOf(...HALL, 60));
  assert.equal(await player.bar(), "", "the town hall can't be removed: nothing to ask");
  await player.shot("removed");
  const removed = await player.saved();
  assert.ok(!has(removed, HOUSE[0], HOUSE.slice(1)), "the house is sold");
  assert.ok(!has(removed, ROCK[0], ROCK.slice(1)), "the rock is gone");
  assert.ok(removed.items.some(([id]) => id === 26), "the town hall stays");

  // Cancel: back to the pointer.
  await page.locator(".pointer-tool").click();
  assert.equal(await page.locator(".pointer-tool").getAttribute("aria-label"), "Tools");

  // The glove over the ready farm: collected (the farm is ready 32.4 seconds after the villager went in).
  await player.wait(Math.max(0, setUpAt + 35_000 - Date.now()));
  const before = await player.saved({ waitForBatch: false });
  await page.locator(".pointer-tool").click();
  await page.locator('.tool-menu [data-tool="collect"]').click();
  const field = player.screenOf(54.5, 55.5, 20);
  await page.mouse.move(field.x - 150, field.y + 60);
  await page.mouse.move(field.x + 150, field.y - 40, { steps: 25 });
  await player.shot("swept");
  const after = await player.saved();
  assert.equal(after.food, before.food + 15, "the glove collected the farm");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".pointer-tool").getAttribute("aria-label"), "Tools", "Escape puts the glove down");

  // On a phone: the corner's buttons above the dock, the menu open.
  const phone = await player.onPhone();
  await phone.page.locator(".pointer-tool").click();
  assert.ok(await phone.page.locator(".tool-menu").isVisible());
  await phone.shot("phone");
}
