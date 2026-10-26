// Light art (CLIENT.md, "Light art"). Big units' pictures go to the
// graphics chip and the page lets go of its own copy, keeping a map of
// where they're see-through for taps; if the chip is reset, they're made
// again. On a phone, or when chosen in the Menu, big units are kept at half
// size, a quarter of the memory; on a phone, Fast drawing is on unless
// switched off.

import assert from "node:assert/strict";

const INFERNAL = 758, VULCANO = 847;
const ART = { [INFERNAL]: "758_infernaldragon", [VULCANO]: "847_vulcano_dragon" };

/** The dragons, bought where the map shows them. */
const DRAGONS = [
  { cmd: "rt_level_up", args: [30] },
  { cmd: "buy", args: [INFERNAL, 50, 44, 0, 0, 1, 1] },
  { cmd: "buy", args: [VULCANO, 54, 48, 0, 0, 1, 1] },
];

/** Waits for both dragons' map copies, and says what they are: sizes, and whether the page let go of its own copy. */
async function copies(page) {
  await page.waitForFunction((ids) => {
    const { town, view } = window.seHome?.parts ?? {};
    return ids.every((id) => {
      const placed = town?.items.find((p) => p.item.id === id);
      const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
      return picture?.texture?.source?.label?.includes(" in town");
    });
  }, [INFERNAL, VULCANO], { timeout: 60_000 });
  return page.evaluate(async (arts) => {
    const { art } = window.seHome.parts;
    const out = {};
    for (const name of arts) {
      const town = await art.unit(name);
      const index = await (await fetch(`${art.base}/${name}.json`)).json();
      const sources = [...new Set([...town.animations.values()].flat().map((t) => t.source))];
      out[name] = {
        sheetScale: Number(index.meta.scale),
        resolutions: [...new Set(sources.map((s) => s.resolution))],
        pixels: sources.reduce((sum, s) => sum + s.pixelWidth * s.pixelHeight, 0),
        letGo: sources.every((s) => s.resource instanceof ImageData),
      };
    }
    return { arts: out, half: art.halfSize };
  }, Object.values(ART));
}

/** A picture of the town copy, read back from the graphics chip, against the same picture cut from the sheet's file. */
async function compare(page, name) {
  return page.evaluate(async (name) => {
    const { art } = window.seHome.parts;
    const renderer = art.chip.renderer;
    const town = await art.unit(name);
    const texture = town.pose(1, 2)[0];
    const chip = renderer.texture.getPixels(texture);
    const cut = await art.cutouts(name, (runs) => [[runs[1 * 5 + 2][1][0]]]);
    const image = cut.runs[0][0].image;
    const canvas = Object.assign(document.createElement("canvas"), { width: chip.width, height: chip.height });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, chip.width, chip.height);
    const file = context.getImageData(0, 0, chip.width, chip.height).data;
    // Their see-through parts, pixel for pixel.
    let off = 0, seen = 0;
    for (let i = 3; i < file.length; i += 4) {
      if (file[i] > 0 || chip.pixels[i] > 0) seen++;
      if (Math.abs(file[i] - chip.pixels[i]) > 2) off++;
    }
    return { width: chip.width, height: chip.height, seen, off };
  }, name);
}

export default async function lightArt({ newPlayer }) {
  // A computer: full size (two dragons are well within the budget), kept on the chip only.
  const player = await newPlayer();
  const { page } = player;
  await player.send(DRAGONS);
  await player.reload();
  const first = await copies(page);
  console.log(`  map copies: ${Object.entries(first.arts).map(([name, a]) => `${name} ${(a.pixels * 4 / 2 ** 20).toFixed(0)} MB`).join(", ")}`);
  assert.equal(first.half, false, "a computer with room keeps them at full size");
  for (const [name, a] of Object.entries(first.arts)) {
    assert.ok(a.letGo, `${name}: the page let go of its own copy`);
    assert.deepEqual(a.resolutions, [a.sheetScale], `${name}: at the sheet's own size`);
  }
  await player.shot("town");

  // The pictures on the chip are the sheet's.
  const before = await compare(page, ART[VULCANO]);
  assert.ok(before.seen > 100, "a picture with something in it");
  assert.equal(before.off, 0, "every pixel the sheet's");

  // A tap on a dragon's picture still finds it (its map of see-through parts).
  const tapped = await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const picture = view.slots.get(placed).children.find((c) => c.texture && c.label !== "selected");
    const box = picture.getBounds();
    return view.itemAt({ x: box.x + box.width / 2, y: box.y + box.height * 0.6 })?.item.id ?? null;
  }, VULCANO);
  assert.equal(tapped, VULCANO, "tapping the dragon picks it");

  // The graphics chip reset (as a phone may do to a page in the background): the pictures are made again.
  await page.evaluate(() => window.seHome.parts.art.chip.renderer.context.forceContextLoss());
  await page.waitForFunction(() => !window.seHome.parts.art.chip.renderer.context.isLost, null, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  const after = await compare(page, ART[VULCANO]);
  assert.deepEqual(after, before, "the same pixels after the reset");
  await player.shot("after-reset");

  // Light art in the Menu: off here; switched on, the next page keeps big units at half size.
  await page.getByRole("button", { name: /^Menu/ }).click();
  const light = page.getByRole("menuitemcheckbox", { name: "Light art" });
  assert.ok(await light.isVisible(), "Light art is in the Menu");
  assert.equal(await light.getAttribute("aria-checked"), "false");
  await light.click();
  assert.equal(await light.getAttribute("aria-checked"), "true");
  assert.equal(await page.evaluate(() => localStorage.getItem("se-light-art")), "on");
  await player.reload();
  const light2 = await copies(page);
  assert.equal(light2.half, true);
  for (const [name, a] of Object.entries(light2.arts)) {
    assert.deepEqual(a.resolutions, [a.sheetScale / 2], `${name}: at half size`);
    assert.ok(a.pixels < first.arts[name].pixels / 3, `${name}: about a quarter of the pixels`);
  }
  await player.shot("light-art");

  // A phone: Fast drawing and light art, unless switched off.
  const phone = await newPlayer({ phone: true });
  await phone.send(DRAGONS);
  await phone.reload();
  const small = await copies(phone.page);
  assert.equal(small.half, true, "a phone keeps big units at half size");
  assert.equal(await phone.page.evaluate(() => window.seHome.parts.art.chip.renderer.resolution), 1, "and draws one for one");
  await phone.shot("phone");
}
