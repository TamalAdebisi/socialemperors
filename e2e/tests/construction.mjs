// Building (CLIENT.md, "Construction"), as the Flash client does it: a farm
// bought stands in scaffolding for 10 seconds with a bar under it, its card
// has no buttons, and a villager can't go in; then it's finished, and in
// the villager goes. Stored and placed again, it's built again. The save
// has it at once (the scaffolding isn't saved).

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const FARM = 10, VILLAGER = 500;
const FARM_AT = [56, 55], AGAIN_AT = [57, 54], VILLAGER_AT = [53, 57];

export default async function construction({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "buy", args: [VILLAGER, ...VILLAGER_AT, 0, 0, 1, 1] }]);
  await player.reload();
  const villager = (await player.select(VILLAGER_AT, "Villager I")).point;
  await player.press("Close");
  // The farm as the page has it: being built (its time to finish), and who's inside.
  const farm = (at) => page.evaluate(([x, y]) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 10 && p.tx === x && p.ty === y);
    return placed ? { building: placed.builtAt !== undefined && placed.builtAt > Date.now(), inside: placed.unitsInside } : null;
  }, at);

  // Bought: the scaffolding and its bar.
  await player.press("Build");
  await player.press("Resources");
  await player.card("Farm Land").click();
  await player.tapTile(FARM_AT);
  await player.press("Done");
  const boughtAt = Date.now();
  await player.wait(1500);
  await player.shot("building");
  assert.deepEqual(await farm(FARM_AT), { building: true, inside: 0 }, "in scaffolding");

  // Its card: how far along, no buttons. A villager sent at it stays out.
  const card = await player.select(FARM_AT, "Farm Land");
  assert.match(card.text, /Being built… \d+%/);
  const buttons = await player.barButtons();
  for (const name of ["Move", "Store", "Sell", "Turn"]) assert.ok(!buttons.some((b) => b.includes(name)), `no ${name} yet`);
  await player.press("Close");
  await player.click(villager);
  await player.click(card.point);
  await player.wait(1000);
  assert.ok(Date.now() - boughtAt < 9000, "all that while it was being built");
  assert.equal((await farm(FARM_AT)).inside, 0, "nobody goes into a farm being built");
  assert.ok(has(await player.saved(), FARM, FARM_AT), "the save has the farm all the same");

  // Ten seconds on: finished, with its buttons, and in the villager goes.
  await player.wait(Math.max(0, boughtAt + 10_500 - Date.now()));
  assert.deepEqual(await farm(FARM_AT), { building: false, inside: 0 }, "built");
  await player.shot("built");
  if (await player.bar()) await page.keyboard.press("Escape");
  await player.click(villager);
  await player.click(card.point);
  await page.waitForFunction((at) => window.seHome.parts.town.items.some((p) => p.item.id === 10 && p.tx === at[0] && p.ty === at[1] && p.unitsInside === 1),
    FARM_AT, { timeout: 15_000 });
  const done = await player.select(FARM_AT, "Farm Land");
  assert.ok((await player.barButtons()).some((b) => b.includes("Move")), "Move now");
  assert.doesNotMatch(done.text, /Being built/);

  // Stored and placed again: built again.
  await player.press("Store");
  await player.press("Storage");
  await player.card("Farm Land").getByRole("button", { name: "Place" }).click();
  await player.wait(300);
  await player.tapTile(AGAIN_AT);
  await player.wait(1000);
  assert.deepEqual(await farm(AGAIN_AT), { building: true, inside: 0 }, "placed from storage: in scaffolding again");
  await player.shot("again");

  // Not saved: opened again, it's finished.
  await player.reload();
  assert.deepEqual(await farm(AGAIN_AT), { building: false, inside: 0 }, "opened again: finished");
}
