// Selection stays around its building. A placement picture that finishes
// loading after the pointer moved must land on the footprint, once.
import assert from "node:assert/strict";
import { has } from "../lib.mjs";

export default async function buildingOverlay({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const clearGround = { x: 800, y: 580, width: 80, height: 35 };
  await page.mouse.move(20, 10);
  const before = await player.pixels(clearGround);
  await player.select([44, 52], "House I");
  const after = await player.pixels(clearGround);
  assert.deepEqual(after, before, "selecting a building cannot tint a distant strip of ground");
  await player.shot("selected");
  await player.press("Close");
  await page.mouse.move(20, 10);

  // First get the true picture bounds, drawn without any loading delay.
  const baseline = await page.evaluate(async () => {
    const { editor, items, view } = window.seHome.parts;
    editor.startBuilding(items.get(10));
    await view.art.get(items.get(10).art);
    await Promise.resolve();
    const b = view.ghost.slot.getBounds();
    const origin = { x: editor.building.tx, y: editor.building.ty };
    editor.stopBuilding();
    return { x: b.x, y: b.y, width: b.width, height: b.height, origin };
  });
  const shifted = await page.evaluate(async ({ origin }) => {
    const { editor, items, view, camera } = window.seHome.parts;
    const get = view.art.get.bind(view.art);
    const item = items.get(10);
    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    view.art.get = async (name) => {
      if (name === item.art) await waiting;
      return get(name);
    };
    editor.startBuilding(item);
    const destination = { x: origin.x + 2, y: origin.y + 4 };
    editor.previewBuilding(destination);
    release();
    await view.art.get(item.art);
    await Promise.resolve();
    view.art.get = get;
    const b = view.ghost.slot.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height,
      dx: 54 * (2 - 4) * camera.scale, dy: 27 * (2 + 4) * camera.scale };
  }, baseline);
  assert.ok(Math.abs(shifted.x - baseline.x - shifted.dx) < 1, "the picture follows the footprint horizontally once");
  assert.ok(Math.abs(shifted.y - baseline.y - shifted.dy) < 1, "the picture follows the footprint vertically once");
  assert.ok(Math.abs(shifted.width - baseline.width) < 1);
  assert.ok(Math.abs(shifted.height - baseline.height) < 1);
  await player.shot("preview");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.seHome.parts.view.ghost), null);
  assert.ok(has(await player.saved(), 1, [44, 52]), "selection and cancelled previews leave the saved building in place");
}
