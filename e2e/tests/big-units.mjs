// Big units in town (CLIENT.md, "Big units in town"). A Red Djinn Dragon
// Rider's whole sheet is five pages, 247 MB decoded; the map keeps only its
// standing and walking pictures, copied into pages of their own pixel for
// pixel, so a town with a few big dragons stays playable. A raid at home
// loads the whole sheet for the fight, and lets it go when it's over.

import assert from "node:assert/strict";

const RIDER = 2228, ART = "2228_redDjinnDragonRider", KNIGHT = 514, AT = [50, 44];

export default async function bigUnits({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const knights = [0, 1, 2, 3].map((i) => ({ cmd: "buy", args: [KNIGHT, 44 + i, 52, 0, 0, 0, 1] }));
  await player.send([{ cmd: "rt_level_up", args: [12] }, { cmd: "buy", args: [RIDER, ...AT, 0, 0, 1, 1] }, ...knights]);
  await player.reload();
  await page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });

  // The map draws the rider from its own copy.
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const picture = view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return picture?.texture?.source?.resource instanceof HTMLCanvasElement;
  }, RIDER, { timeout: 30_000 });
  await player.shot("town");

  // A fifth of the whole sheet, and the same pictures: sizes, anchors, pixels.
  const compared = await page.evaluate(async (name) => {
    const { art } = window.seHome.parts;
    const town = await art.unit(name);
    const whole = await art.get(name);
    const pixels = (item) => [...new Set([...item.animations.values()].flat().map((t) => t.source))]
      .reduce((sum, source) => sum + source.pixelWidth * source.pixelHeight, 0);
    const read = (texture) => {
      const r = texture.source.resolution, f = texture.frame;
      const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(f.width * r), height: Math.round(f.height * r) });
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(texture.source.resource, f.x * r, f.y * r, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const runs = [...town.animations.keys()];
    const wholeRuns = [...whole.animations.keys()].slice(0, runs.length);
    const problems = [];
    const seen = new Set();
    let pictures = 0;
    for (const [n, run] of runs.entries()) {
      if (run !== wholeRuns[n]) problems.push(`run ${n} is ${run}, the whole sheet's ${wholeRuns[n]}`);
      const mine = town.animations.get(run), theirs = whole.animations.get(run);
      if (mine.length !== theirs.length) problems.push(`${run} has ${mine.length} frames, not ${theirs.length}`);
      for (const [i, texture] of mine.entries()) {
        const other = theirs[i];
        if (seen.has(texture)) continue;
        seen.add(texture);
        pictures++;
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const shape = (t) => ({ orig: [t.orig.width, t.orig.height], frame: [t.frame.width, t.frame.height],
          trim: t.trim && [t.trim.x, t.trim.y, t.trim.width, t.trim.height], anchor: t.defaultAnchor });
        if (!same(shape(texture), shape(other))) {
          problems.push(`${run}/${i}: ${JSON.stringify(shape(texture))} is not ${JSON.stringify(shape(other))}`);
          continue;
        }
        const a = read(texture), b = read(other);
        let off = 0;
        for (let p = 0; p < a.length; p++) if (Math.abs(a[p] - b[p]) > 2) off++;
        if (a.length !== b.length || off > 0) problems.push(`${run}/${i}: ${off} of ${a.length / 4} pixels differ`);
      }
    }
    return { town: pixels(town), whole: pixels(whole), runs: runs.length, pictures, problems: problems.slice(0, 5) };
  }, ART);
  console.log(`  the map's copy: ${compared.pictures} pictures, ${(compared.town * 4 / 2 ** 20).toFixed(0)} MB decoded; the whole sheet ${(compared.whole * 4 / 2 ** 20).toFixed(0)} MB`);
  assert.deepEqual(compared.problems, [], "the map's pictures are the whole sheet's");
  assert.equal(compared.runs, 10, "standing and walking, 5 ways each");
  assert.ok(compared.town < compared.whole / 3, "the map keeps less than a third of the sheet");

  // Let go of: the whole sheet is no longer kept; asked for again, it loads again.
  const after = await page.evaluate(async (name) => {
    const { art } = window.seHome.parts;
    const before = await art.get(name);
    art.letGo([name]);
    const kept = art.loading.has(name);
    const again = await art.get(name);
    return { kept, fresh: again !== before && again !== null, town: art.loading.has(`${name} in town`) };
  }, ART);
  assert.deepEqual(after, { kept: false, fresh: true, town: true });

  // A raid at home: the fight has the whole sheet; when it's over, it's let go.
  await page.evaluate((name) => window.seHome.parts.art.letGo([name]), ART);
  await page.evaluate(() => {
    window.seHome.speed = 4;
    window.seHome.hurry();
  });
  await page.waitForFunction(() => Boolean(window.seHome.fighting), null, { timeout: 30_000 });
  await page.waitForFunction((name) => window.seHome.parts.art.bigPages.has(name), ART, { timeout: 60_000 });
  await player.shot("raid");
  await page.evaluate(() => {
    const { battle } = window.seHome.fighting;
    // The raiders (rules/battle.ts ENEMY), as if the town's units won.
    for (const fighter of battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead)) battle.kill(fighter, null);
  });
  await page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 60_000 });
  const over = await page.evaluate((name) => ({
    whole: window.seHome.parts.art.loading.has(name) || window.seHome.parts.art.bigPages.has(name),
    town: window.seHome.parts.art.loading.has(`${name} in town`),
  }), ART);
  assert.deepEqual(over, { whole: false, town: true }, "after the raid, only the map's copy is kept");
  // And the map still draws the rider, from its copy.
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id && !p.dead);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return Boolean(picture && picture.texture.source.resource instanceof HTMLCanvasElement && !picture.texture.source.destroyed);
  }, RIDER, { timeout: 30_000 });
  await player.shot("after-raid");
}
