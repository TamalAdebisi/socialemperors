// The keyboard (CLIENT.md, "Step 2" and "The menus"): letters open their
// windows and don't move the map (S, A and W used to do both); the arrow
// keys move it, as in the Flash client. Space turns a building being placed
// or moved, and it's bought or moved facing that way, as the save hears.

import assert from "node:assert/strict";
import { itemAt } from "../lib.mjs";

const TOWER = [51, 47], FARM = 10, FARM_AT = [56, 56], MOVED_TO = [57, 52];

export default async function keys({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const lit = async () => page.locator(".menu[aria-pressed=true]").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
  const hold = async (key) => {
    await page.keyboard.down(key);
    await player.wait(400);  // 360 pixels' worth, if it moved the map
    await page.keyboard.up(key);
    await player.wait(200);
  };

  // Each letter opens its window; the map stays where it was (the tower is where it was on the screen).
  for (const [key, name] of [["s", "Storage"], ["a", "Army"]]) {
    await hold(key);
    assert.deepEqual(await lit(), [name], `${key.toUpperCase()} opens ${name}`);
    await page.keyboard.press("Escape");
  }
  await hold("w");  // the World map is the phone's: nothing to open here, and nothing moves
  await hold("d");
  const tower = await player.select(TOWER, "Tower I");
  await player.press("Close");
  // The arrow keys do move it: the tower isn't there any more.
  const cameraAt = () => page.evaluate(() => {
    const camera = window.seHome.parts.camera;
    return { ...camera.toMap({ x: 0, y: 0 }), scale: camera.scale };
  });
  const before = await cameraAt();
  await page.keyboard.down("ArrowRight");
  try {
    // Wait for the intended 360 screen pixels of movement. Software drawing
    // can leave the old 400ms hold without enough frames to move the camera.
    await page.waitForFunction((start) => {
      const camera = window.seHome.parts.camera;
      return (camera.toMap({ x: 0, y: 0 }).x - start.x) * camera.scale >= 360;
    }, before, { timeout: 30_000 });
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  const after = await cameraAt();
  assert.equal(after.scale, before.scale, "the arrow does not zoom");
  assert.ok(Math.abs(after.y - before.y) < 0.01, "the right arrow does not move vertically");
  await player.click(tower.point);
  assert.ok(!(await player.bar()).startsWith("Tower I"), "→ moved the map");
  await player.reload();

  // Space while placing: a farm bought facing its other way.
  await player.menu("Build");
  await player.press("Resources");
  await player.card("Farm Land").click();
  await player.hover(FARM_AT);
  await page.keyboard.press(" ");
  await player.tapTile(FARM_AT);
  await player.press("Done");
  let saved = await player.saved();
  assert.equal(itemAt(saved, FARM, FARM_AT)?.[3], 1, "bought turned");

  // Space while moving: it's moved facing back the first way.
  await player.select(FARM_AT, "Farm Land");
  await player.press("Move");
  await player.hover(MOVED_TO);
  await page.keyboard.press(" ");
  await player.tapTile(MOVED_TO);
  saved = await player.saved();
  assert.equal(itemAt(saved, FARM, FARM_AT), undefined);
  assert.equal(itemAt(saved, FARM, MOVED_TO)?.[3], 0, "moved, turned back");
}
