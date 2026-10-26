// Big units in town (CLIENT.md, "Big units in town"). A Red Djinn Dragon
// Rider's whole sheet is five pages, 247 MB decoded; the map keeps only its
// standing and walking pictures, copied into pages of their own pixel for
// pixel, so a town with a few big dragons stays playable. A raid at home
// loads the fight's own copy (what fighters do), and lets it go when it's over.

import assert from "node:assert/strict";

const RIDER = 2228, ART = "2228_redDjinnDragonRider", KNIGHT = 514, AT = [50, 44];

export default async function bigUnits({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const knights = [0, 1, 2, 3].map((i) => ({ cmd: "buy", args: [KNIGHT, 44 + i, 52, 0, 0, 0, 1] }));
  await player.send([{ cmd: "rt_level_up", args: [12] }, { cmd: "buy", args: [RIDER, ...AT, 0, 0, 1, 1] }, ...knights]);
  await player.reload();
  await page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });

  // The map draws the rider from its own copy, kept on the graphics chip only (view/onChip.ts).
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const picture = view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return picture?.texture?.source?.label?.includes(" in town") && picture.texture.source.resource instanceof ImageData;
  }, RIDER, { timeout: 30_000 });
  await player.shot("town");

  // A fifth of the whole sheet, and the same pictures: sizes, anchors, pixels.
  const compared = await page.evaluate(async (name) => {
    const { art } = window.seHome.parts;
    const town = await art.unit(name);
    const whole = await art.get(name);
    const pixels = (item) => [...new Set([...item.animations.values()].flat().map((t) => t.source))]
      .reduce((sum, source) => sum + source.pixelWidth * source.pixelHeight, 0);
    // Read from the graphics chip, where both are kept.
    const read = (texture) => art.chip.renderer.texture.getPixels(texture).pixels;
    // Every run in its place (the moves keep their numbers), standing and walking's filled, the others empty.
    const allRuns = [...town.animations.keys()];
    const wholeRuns = [...whole.animations.keys()];
    const problems = [];
    if (allRuns.join() !== wholeRuns.join()) problems.push("the copy's runs aren't the sheet's");
    const runs = allRuns.filter((run) => town.animations.get(run).length > 0);
    if (runs.join() !== wholeRuns.slice(0, 10).join()) problems.push(`the copy fills ${runs.length} runs, not standing and walking's 10`);
    const seen = new Set();
    let pictures = 0;
    for (const run of runs) {
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
  // The fight's own copy of the rider: what fighters do and its special moves (ArtLibrary.fighter).
  await page.waitForFunction(async (name) => {
    const art = window.seHome.parts.art;
    return art.loading.has(`${name} in fights`) && art.copies.has(`${name} in fights`);
  }, ART, { timeout: 60_000 });
  await player.shot("raid");
  // A move the copy left out is loaded when it plays: one of the rider's special moves, which the specials table doesn't give it.
  const moved = await page.evaluate(async ({ name, id }) => {
    const { art } = window.seHome.parts;
    const { battle } = window.seHome.fighting;
    const fights = await art.fighter(name);
    const move = [...fights.leftOut][0];
    const rider = battle.fighters.find((f) => f.item.id === id && !f.dead);
    if (!rider || move === undefined) return { leftOut: [...fights.leftOut] };
    rider.special = { animation: move, until: battle.frame + 300 };
    for (let i = 0; i < 100 && !art.loading.has(`${name} move ${move}`); i++) await new Promise((r) => setTimeout(r, 100));
    const more = await art.loading.get(`${name} move ${move}`);
    return { leftOut: [...fights.leftOut], move: more?.numbered(move, 0)?.length ?? 0 };
  }, { name: ART, id: RIDER });
  console.log(`  the fight copy left out moves ${moved.leftOut.join(", ")}`);
  assert.ok(moved.leftOut.length > 0, "the fight copy leaves out the moves fighters don't use");
  assert.ok(moved.move > 0, "a left-out move is loaded when it plays");
  await page.evaluate(() => {
    const { battle } = window.seHome.fighting;
    // The raiders (rules/battle.ts ENEMY), as if the town's units won.
    for (const fighter of battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead)) battle.kill(fighter, null);
  });
  await page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 60_000 });
  const over = await page.evaluate((name) => {
    const { art } = window.seHome.parts;
    return {
      whole: art.loading.has(name) || art.copies.has(name),
      fights: [...art.loading.keys()].some((key) => key === `${name} in fights` || key.startsWith(`${name} move `)),
      town: art.loading.has(`${name} in town`),
    };
  }, ART);
  assert.deepEqual(over, { whole: false, fights: false, town: true }, "after the raid, only the map's copy is kept");
  // And the map still draws the rider, from its copy.
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id && !p.dead);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return Boolean(picture && picture.texture.source.label?.includes(" in town") && !picture.texture.source.destroyed);
  }, RIDER, { timeout: 30_000 });
  await player.shot("after-raid");
}
