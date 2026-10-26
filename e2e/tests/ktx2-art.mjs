// Big units' art as the graphics chip keeps it (CLIENT.md, "Light art"):
// a sheet of several pages packed move by move (tools/art/pack_sheet.py)
// comes with each page as KTX2 and a mask file. The map uses the town's
// pages as they are, in the graphics chip's format, four times smaller there
// than the decoded WebP; light art uses their half-size copies; taps use the
// mask; and after a graphics chip reset they're read again.
//
// Needs the Vulcano Dragon exported that way (KTX2=1 tools/export_art.sh):
// skipped, and says so, when its sheet has no KTX2 pages.

import assert from "node:assert/strict";

const VULCANO = 847, ART = "847_vulcano_dragon";

/** The dragon's map art: its pages' kinds, formats, sizes. */
async function townArt(page) {
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome?.parts ?? {};
    const placed = town?.items.find((p) => p.item.id === id);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return picture?.texture?.source?.label?.includes(" in town");
  }, VULCANO, { timeout: 60_000 });
  return page.evaluate(async (name) => {
    const { art } = window.seHome.parts;
    const town = await art.unit(name);
    const sources = [...new Set([...town.animations.values()].flat().map((t) => t.source))];
    return {
      half: art.halfSize,
      sources: sources.map((s) => ({ kind: s.uploadMethodId, format: s.format, w: s.pixelWidth, h: s.pixelHeight,
        resolution: s.resolution, levels: s.mipLevelCount, letGo: Array.isArray(s.resource) ? s.resource.length === 0 : s.resource instanceof ImageData })),
    };
  }, ART);
}

/** A walking picture drawn from the chip's copy, against the same picture cut from the WebP: how far apart. */
async function compare(page) {
  return page.evaluate(async (name) => {
    const { art, view, town } = window.seHome.parts;
    const renderer = art.chip.renderer;
    const unit = await art.unit(name);
    const texture = unit.pose(1, 2)[0];
    const placed = town.items.find((p) => p.item.art === name);
    const Picture = view.slots.get(placed).children.find((c) => c.texture && c.label !== "selected").constructor;
    const sprite = new Picture([texture]);
    sprite.anchor?.set(0, 0);
    const { pixels, width, height } = renderer.extract.pixels({ target: sprite, resolution: texture.source.resolution });
    sprite.destroy();
    const cut = await art.cutouts(name, (runs) => [[runs[1 * 5 + 2][1][0]]]);
    const picture = cut.runs[0][0];
    // The sprite's box is the whole canvas; the picture sits at its trim.
    const r = texture.source.resolution;
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(picture.image, (texture.trim?.x ?? 0) * r, (texture.trim?.y ?? 0) * r, picture.width * r, picture.height * r);
    const file = context.getImageData(0, 0, width, height).data;
    let alpha = 0, seen = 0;
    for (let i = 3; i < file.length; i += 4) {
      if (file[i] === 0 && pixels[i] === 0) continue;
      seen++;
      alpha += Math.abs(file[i] - pixels[i]);
    }
    return { seen, meanAlphaOff: alpha / Math.max(1, seen) };
  }, ART);
}

export default async function ktx2Art({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const ready = await page.evaluate(async (name) => {
    const response = await fetch(`${window.seHome.parts.art.base}/${name}.json`);
    return response.ok && Boolean((await response.json()).meta.ktx2);
  }, ART).catch(() => false);
  if (!ready) {
    console.log(`  skipped: ${ART} has no KTX2 pages here (export it with KTX2=1 tools/export_art.sh)`);
    return;
  }
  await player.send([{ cmd: "rt_level_up", args: [30] }, { cmd: "buy", args: [VULCANO, 52, 46, 0, 0, 1, 1] }]);
  await player.reload();

  // At full size: the town's pages as they are, in the graphics chip's format, let go of by the page.
  const full = await townArt(page);
  console.log(`  map pages: ${full.sources.map((s) => `${s.kind} ${s.format} ${s.w} x ${s.h}, ${s.levels} sizes`).join("; ")}`);
  assert.equal(full.half, false);
  assert.ok(full.sources.every((s) => s.kind === "compressed" && s.format === "bc7-rgba-unorm"), "BC7, the chip's best");
  assert.ok(full.sources.every((s) => s.letGo), "the page keeps no copy");
  assert.ok(full.sources.every((s) => s.w % 4 === 0 && s.h % 4 === 0 && s.levels > 1), "whole blocks, with smaller copies");
  const looks = await compare(page);
  console.log(`  against the WebP: alpha ${looks.meanAlphaOff.toFixed(2)} apart on average, over ${looks.seen} pixels`);
  assert.ok(looks.seen > 100 && looks.meanAlphaOff < 4, "the same picture, within the compression");
  await player.shot("town");

  // A tap on the dragon, by its mask.
  const tapped = await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const picture = view.slots.get(placed).children.find((c) => c.texture && c.label !== "selected");
    const box = picture.getBounds();
    return view.itemAt({ x: box.x + box.width / 2, y: box.y + box.height * 0.6 })?.item.id ?? null;
  }, VULCANO);
  assert.equal(tapped, VULCANO);

  // A graphics chip reset: drawing waits, then the pages are read again.
  await page.evaluate(() => window.seHome.parts.art.chip.renderer.context.forceContextLoss());
  await page.waitForFunction(() => !window.seHome.parts.art.chip.renderer.context.isLost, null, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  const again = await compare(page);
  assert.ok(Math.abs(again.meanAlphaOff - looks.meanAlphaOff) < 0.01, "the same pixels after the reset");
  await player.shot("after-reset");

  // Light art: the same pages' half-size copies.
  await page.evaluate(() => localStorage.setItem("se-light-art", "on"));
  await player.reload();
  const light = await townArt(page);
  assert.equal(light.half, true);
  light.sources.forEach((s, n) => {
    assert.equal(s.kind, "compressed");
    assert.deepEqual([s.w, s.h], [full.sources[n].w / 2, full.sources[n].h / 2], "half size each way");
  });
  await player.shot("light-art");
}
