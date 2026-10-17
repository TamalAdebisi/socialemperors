// Selection stays around its building. A placement picture that finishes
// loading after the pointer moved must land on the footprint, once.
import assert from "node:assert/strict";
import { has } from "../lib.mjs";

export default async function buildingOverlay({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  // WebKit can capture a canvas's previous frame after synchronous scene
  // edits. Let the real drawing ticker present this state before comparing
  // pixels or reviewing its screenshot.
  const drawn = () => page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const clearGround = { x: 800, y: 580, width: 80, height: 35 };
  await page.mouse.move(20, 10);
  // The first compositor capture can still contain the flat loading color.
  // Wait for textured ground before comparing it with selected buildings.
  let before;
  const readyBy = Date.now() + 10_000;
  do {
    await drawn();
    before = await player.pixels(clearGround);
    if (new Set(before.map((pixel) => pixel.join(","))).size > 1) break;
  } while (Date.now() < readyBy);
  assert.ok(new Set(before.map((pixel) => pixel.join(","))).size > 1, "the ground texture has rendered before selection");
  for (const [tile, name] of [[[44, 52], "House I"], [[51, 47], "Tower I"], [[52, 52], "Town Hall"]]) {
    await player.select(tile, name);
    await drawn();
    const after = await player.pixels(clearGround);
    assert.deepEqual(after, before, `selecting ${name} cannot tint a distant strip of ground`);
    await player.shot(`selected-${name.replaceAll(" ", "-").toLowerCase()}`);
    await player.press("Close");
    await page.mouse.move(20, 10);
  }

  // Different picture sizes share the same preview path: house, farm,
  // ranch, mine and tower must all stay aligned while their art loads.
  for (const itemId of [1, 10, 11, 13, 29]) {
    // First get the true picture bounds, drawn without any loading delay.
    const baseline = await page.evaluate(async (itemId) => {
      const { editor, items, view } = window.seHome.parts;
      editor.startBuilding(items.get(itemId));
      await view.art.get(items.get(itemId).art);
      await Promise.resolve();
      const b = view.ghost.slot.getBounds();
      const origin = { x: editor.building.tx, y: editor.building.ty };
      editor.stopBuilding();
      return { x: b.x, y: b.y, width: b.width, height: b.height, origin };
    }, itemId);
    const shifted = await page.evaluate(async ({ origin, itemId }) => {
      const { editor, items, view, camera } = window.seHome.parts;
      const get = view.art.get.bind(view.art);
      const item = items.get(itemId);
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
    }, { origin: baseline.origin, itemId });
    assert.ok(Math.abs(shifted.x - baseline.x - shifted.dx) < 1, `${itemId}'s picture follows the footprint horizontally once`);
    assert.ok(Math.abs(shifted.y - baseline.y - shifted.dy) < 1, `${itemId}'s picture follows the footprint vertically once`);
    assert.ok(Math.abs(shifted.width - baseline.width) < 1);
    assert.ok(Math.abs(shifted.height - baseline.height) < 1);
    await page.evaluate(() => window.seHome.parts.editor.refresh());
    assert.equal(await page.evaluate(() => window.seHome.parts.view.marks.children.length), 1,
      "the previous building's hover cannot erase the new placement footprint on refresh");
    await drawn();
    await player.shot(`preview-${itemId}`);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.seHome.parts.view.ghost), null);
  }
  assert.ok(has(await player.saved(), 1, [44, 52]), "selection and cancelled previews leave the saved building in place");
}
