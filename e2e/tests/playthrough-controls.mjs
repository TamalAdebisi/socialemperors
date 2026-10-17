// Unit near misses select the other villager; hidden tabs keep simulating
// without animation frames. Check the real saved destination as well.
import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const FIRST = [49, 55], SECOND = [52, 56], DESTINATION = [48, 58];

export default async function playthroughControls({ newPlayer }) {
  const player = await newPlayer();
  await player.send([FIRST, SECOND].map((at) => ({ cmd: "buy", args: [500, ...at, 0, 0, 1, 1] })));
  // Reproduce browsers withholding animation frames in a hidden tab.
  // The independent timer must do the work, without a test-only game speed.
  await player.page.addInitScript(() => {
    window.visiblePictureBox = (picture) => {
      const b = picture.visualBounds;
      const points = [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }].map((p) => picture.toGlobal(p));
      return { x: Math.min(points[0].x, points[1].x), y: Math.min(points[0].y, points[1].y),
        width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
    };
    window.testHidden = false;
    // Simulated tab hiding must still respect real hiding on navigation:
    // claiming an unloading page is visible starts invalid background polls.
    Object.defineProperty(document, "hidden", { get: () => window.testHidden || document.visibilityState === "hidden" });
    const request = window.requestAnimationFrame.bind(window);
    const pending = [];
    window.requestAnimationFrame = (run) => request((time) => {
      if (window.testHidden) pending.push(run);
      else run(time);
    });
    window.changeTestVisibility = (hidden) => {
      window.testHidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
      if (!hidden) for (const run of pending.splice(0)) request(run);
    };
  });
  await player.reload();
  const { page } = player;
  await player.select(FIRST, "Villager I");
  await player.tapTile(DESTINATION);
  const ring = await page.evaluate(() => {
    const { view } = window.seHome.parts;
    const click = view.markers.click;
    return click && { visible: click.sprite.visible, alpha: click.sprite.alpha, width: click.sprite.getBounds().width,
      events: click.sprite.eventMode };
  });
  assert.ok(ring?.visible && ring.alpha > 0 && ring.width >= 50, "the ground click shows a visible ring");
  assert.equal(ring.events, "none", "the feedback never intercepts another click");
  const near = await page.evaluate(([tx, ty]) => {
    const { town, view } = window.seHome.parts;
    const unit = town.items.find((p) => p.item.id === 500 && p.tx === tx && p.ty === ty);
    const picture = view.slots.get(unit).children.find((p) => !["selected", "life", "hover-life", "outline", "progress"].includes(p.label));
    const box = window.visiblePictureBox(picture);
    return { x: box.x - 5, y: box.y + box.height / 2 };
  }, SECOND);
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, near), "CANVAS");
  await page.evaluate(() => {
    const camera = window.seHome.parts.camera;
    const press = camera.onPress;
    camera.onPress = (at, touch) => {
      camera.onPress = press;
      // A slow first pixel read must not turn a short native click into
      // a rejected long press. Keep the real browser down/up events.
      const until = performance.now() + 650;
      while (performance.now() < until) { /* emulate the stalled render thread */ }
      return press?.(at, touch) ?? false;
    };
  });
  await page.mouse.click(near.x, near.y);
  assert.deepEqual(await page.evaluate(() => {
    const unit = window.seHome.parts.editor.lessonSelected;
    return [unit.tx, unit.ty];
  }), SECOND, "a near miss selects the second villager even when input handling stalls");

  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.changeTestVisibility(true);
  });
  assert.equal(await page.locator(".pause-curtain").count(), 0);
  await page.waitForFunction(([x, y]) => window.seHome.parts.town.items.some((p) =>
    p.item.id === 500 && p.tx === x && p.ty === y), DESTINATION, { timeout: 20_000, polling: 100 });
  assert.ok(has(await player.saved(), 500, DESTINATION), "walking finishes and saves while drawing is suspended");
  assert.ok(has(await player.saved({ waitForBatch: false }), 500, SECOND), "the newly selected villager stayed put");
  await page.evaluate(() => window.changeTestVisibility(false));
  assert.equal(await page.evaluate(() => window.seHome.parts.view.markers.click), null, "the click ring fades away");
  await player.shot("returned");

  await player.press("Pause");
  const frame = await page.evaluate(() => window.seHome.clock);
  await page.evaluate(() => window.changeTestVisibility(true));
  // Wait for an independent timer while the game is explicitly paused.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  assert.equal(await page.evaluate(() => window.seHome.clock), frame);
  await page.evaluate(() => window.changeTestVisibility(false));
  assert.ok(await page.locator(".pause-curtain").isVisible(), "tab changes retain explicit Pause");
  await player.press("Resume");
  await page.waitForFunction((before) => window.seHome.clock > before, frame);

  // At a small zoom the same unit remains selectable outside its tiny art.
  const scale = await page.evaluate(() => {
    const camera = window.seHome.parts.camera;
    const scale = camera.scale;
    camera.zoomBy(0.5, null);
    return scale;
  });
  await page.waitForFunction((scale) => window.seHome.parts.camera.scale < scale * 0.6, scale);
  const small = await page.evaluate(([tx, ty]) => {
    const { town, view } = window.seHome.parts;
    const unit = town.items.find((p) => p.item.id === 500 && p.tx === tx && p.ty === ty);
    const picture = view.slots.get(unit).children.find((p) => !["selected", "life", "hover-life", "outline", "progress"].includes(p.label));
    const box = window.visiblePictureBox(picture);
    const at = { x: box.x + box.width / 2 - 21, y: box.y + box.height / 2 };
    return { at, hit: view.itemAt(at) === unit };
  }, SECOND);
  assert.ok(small.hit, "the zoomed-out unit has at least a 44px target");

  const phone = await player.onPhone();
  await phone.page.evaluate(() => {
    window.visiblePictureBox = (picture) => {
      const b = picture.visualBounds;
      const points = [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }].map((p) => picture.toGlobal(p));
      return { x: Math.min(points[0].x, points[1].x), y: Math.min(points[0].y, points[1].y),
        width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
    };
  });
  await page.close();
  const target = await phone.page.evaluate(async ([tx, ty]) => {
    const { town, view, camera } = window.seHome.parts;
    const unit = town.items.find((p) => p.item.id === 500 && p.tx === tx && p.ty === ty);
    camera.lookAt({ x: 54 * (tx - ty), y: 27 * (tx + ty) - 81 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const picture = view.slots.get(unit).children.find((p) => !["selected", "life", "hover-life", "outline", "progress"].includes(p.label));
    const b = window.visiblePictureBox(picture);
    return { x: b.x - 5, y: b.y + b.height / 2 };
  }, SECOND);
  assert.equal(await phone.page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, target), "CANVAS");
  await phone.page.touchscreen.tap(target.x, target.y);
  await phone.page.waitForFunction(([tx, ty]) => {
    const unit = window.seHome.parts.editor.lessonSelected;
    return unit?.tx === tx && unit?.ty === ty;
  }, SECOND);
  assert.deepEqual(await phone.page.evaluate(() => {
    const unit = window.seHome.parts.editor.lessonSelected;
    return [unit.tx, unit.ty];
  }), SECOND, "a finger near the villager selects it too");
  await phone.page.evaluate(async () => {
    // The newly opened card loads its parchment on demand. Wait for it
    // and the canvas's selection ring before the visual review, in WebKit too.
    const source = getComputedStyle(document.querySelector(".actions.card")).borderImageSource;
    const picture = new Image();
    picture.src = source.match(/^url\(["']?(.*?)["']?\)$/)[1];
    await picture.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await phone.shot("phone-selection");
}
