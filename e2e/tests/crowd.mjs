// A busy town (CLIENT.md, "A busy town"). Two lines of villagers walk
// through each other: the map keeps every picture back to front as they go
// (each slot's place is a number, sorted once a frame) and the save hears
// where each stopped. What's off the screen isn't drawn (culled), and comes
// back as the camera gets there; nothing on the screen is ever left out.
// Hovering still finds a villager. On a Retina-like screen, Fast drawing in
// the Menu draws one pixel for one, at once and after reloading; on an
// ordinary screen it isn't offered.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const VILLAGER = 500;
// Two rows of eight at the top (y 53, 54) and two at the bottom (57, 58), in
// view of the camera as the town opens; each villager walks to the other side.
const COLUMNS = [53, 54, 55, 56, 57, 58, 59, 60];
const ROWS = [53, 54, 57, 58];
const across = ([x, y]) => [113 - x, 111 - y];
const CROWD = ROWS.flatMap((y) => COLUMNS.map((x) => [x, y]));
// A tree of the wild corner (lib.mjs, FULL_WILD), far off the screen.
const FAR_TREE = [10, 5];

export default async function crowd({ newPlayer }) {
  const player = await newPlayer({ scale: 2 });
  const { page } = player;
  await player.send(CROWD.map(([x, y]) => ({ cmd: "buy", args: [VILLAGER, x, y, 0, 0, 0, 1] })));
  await player.reload();

  /**
   * Once a frame has been drawn: what's left out is worked out just before
   * drawing (the camera can move between frames), and drawing all those
   * pixels in software can take a while here.
   */
  const frame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  /** Whatever is drawn out of order: something drawn after a thing in front of it. Null when all is in order. */
  const disorder = () => page.evaluate(() => {
    const view = window.seHome.parts.view;
    view.things.sortChildren();
    const owner = new Map([...view.slots].map(([placed, slot]) => [slot, placed]));
    // As rules/geometry.ts depth(): further back first, farms under everything, one animal a step forward.
    const depth = (p) => 20000 + 100 * (p.tx + p.ty - p.item.width) - (p.item.subcategory === 122 ? 20000 : p.item.id === 524 ? -1 : 0);
    let before = null;
    for (const slot of view.things.children) {
      const placed = owner.get(slot);
      if (!placed) continue;
      const now = { depth: depth(placed), index: view.town.items.indexOf(placed), name: `${placed.item.name} at ${placed.tx},${placed.ty}` };
      if (before && (now.depth < before.depth || (now.depth === before.depth && now.index < before.index))) {
        return `${now.name} is drawn after ${before.name}, which stands in front of it`;
      }
      before = now;
    }
    return null;
  });
  /** What's culled, and anything culled that shows on the screen (all of its slot: bars, rings and all). */
  const culling = () => page.evaluate(() => {
    const view = window.seHome.parts.view;
    const wrong = [];
    let culled = 0;
    for (const [placed, slot] of view.slots) {
      const box = slot.getBounds();
      const shows = box.width > 0 && box.x < innerWidth && box.x + box.width > 0 && box.y < innerHeight && box.y + box.height > 0;
      if (slot.culled) {
        culled++;
        if (shows) wrong.push(`${placed.item.name} at ${placed.tx},${placed.ty}`);
      }
    }
    return { culled, drawn: view.slots.size - culled, wrong };
  });
  /** Screen pixels per page pixel the map is drawn with. */
  const density = () => page.evaluate(() => {
    const canvas = document.querySelector("#stage canvas");
    return canvas.width / canvas.getBoundingClientRect().width;
  });

  // As the town opens: in order; the wild corner left out; all that shows, drawn.
  await frame();
  assert.equal(await disorder(), null);
  const opening = await culling();
  assert.deepEqual(opening.wrong, [], "nothing on the screen is left out");
  assert.ok(opening.culled > 200, `the wild corner's trees, rocks and animals aren't drawn (${opening.culled} left out)`);
  assert.equal(await density(), 2, "a Retina-like screen is drawn sharp at first");

  // The crowd crosses. While they walk, every picture stays back to front.
  const sent = await page.evaluate((plan) => {
    const { editor, town } = window.seHome.parts;
    return plan.filter(([from, to]) => {
      const unit = town.items.find((p) => p.item.id === 500 && p.tx === from[0] && p.ty === from[1]);
      return unit && editor.walkTo(unit, { x: to[0], y: to[1] });
    }).length;
  }, CROWD.map((tile) => [tile, across(tile)]));
  assert.equal(sent, CROWD.length, "every villager sets off");
  let checks = 0;
  for (let walking = true; walking; checks++) {
    assert.equal(await disorder(), null, `in order while they walk (look ${checks + 1})`);
    assert.deepEqual((await culling()).wrong, [], "nothing on the screen left out while they walk");
    if (checks === 3) await player.shot("crossing");
    walking = await page.evaluate(() => window.seHome.parts.view.walkers.size > 0);
    await player.wait(120);
    assert.ok(checks < 300, "they get there");
  }
  assert.ok(checks > 5, `looked at the order as they walked (${checks} times)`);
  assert.equal(await disorder(), null);
  await player.shot("crossed");
  const saved = await player.saved();
  for (const tile of CROWD) {
    assert.ok(has(saved, VILLAGER, across(tile)), `the save has the villager from ${tile} at ${across(tile)}`);
  }

  // Hovering over one of them (in the middle of the crowd, well on the screen) lights it, as before.
  await player.hover(across([57, 57]));
  assert.equal(await page.evaluate(() => window.seHome.parts.view.hovered?.item.id), VILLAGER, "the villager under the pointer is lit");
  await page.mouse.move(5, 400);

  // The camera goes to the wild corner: its tree is drawn there, the crowd left out; nothing on the screen missing.
  await page.evaluate(([x, y]) => {
    const { view, camera } = window.seHome.parts;
    const tree = [...view.slots.keys()].find((p) => p.tx === x && p.ty === y);
    const picture = view.slots.get(tree).children[0];
    camera.lookAt({ x: picture.x, y: picture.y });
  }, FAR_TREE);
  await player.wait(300);
  await frame();
  const far = await culling();
  assert.deepEqual(far.wrong, [], "nothing on the screen is left out after the camera moved");
  const farTree = await page.evaluate(([x, y]) => {
    const { view } = window.seHome.parts;
    const tree = [...view.slots.keys()].find((p) => p.tx === x && p.ty === y);
    return view.slots.get(tree).culled;
  }, FAR_TREE);
  assert.equal(farTree, false, "the far tree is drawn now");
  assert.ok(far.culled >= CROWD.length, "the crowd, off the screen now, is left out");
  await player.shot("wild-corner");

  // Fast drawing, in the Menu: one pixel for one at once, a tick by it; it holds after reloading; off again, sharp.
  await page.getByRole("button", { name: /^Menu/ }).click();
  const fast = page.getByRole("menuitemcheckbox", { name: "Fast drawing" });
  assert.ok(await fast.isVisible(), "Fast drawing is in the Menu on this screen");
  assert.equal(await fast.getAttribute("aria-checked"), "false");
  await player.shot("menu");
  await fast.click();
  assert.equal(await fast.getAttribute("aria-checked"), "true");
  assert.equal(await density(), 1, "drawn one for one at once");
  await player.shot("fast-drawing");
  await player.reload();
  assert.equal(await density(), 1, "still, after reloading");
  await page.getByRole("button", { name: /^Menu/ }).click();
  assert.equal(await fast.getAttribute("aria-checked"), "true");
  await fast.click();
  assert.equal(await density(), 2, "sharp again");
  assert.equal(await page.evaluate(() => localStorage.getItem("se-fast-drawing")), "off");
  await page.keyboard.press("Escape");

  // An ordinary screen: nothing to gain, so not offered.
  const plain = await newPlayer();
  await plain.page.getByRole("button", { name: /^Menu/ }).click();
  assert.equal(await plain.page.getByRole("menuitemcheckbox", { name: "Fast drawing" }).isVisible(), false);
  assert.equal(await plain.page.evaluate(() => {
    const canvas = document.querySelector("#stage canvas");
    return canvas.width / canvas.getBoundingClientRect().width;
  }), 1);
}
