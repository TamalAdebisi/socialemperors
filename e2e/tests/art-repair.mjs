// The art after its repair of 27 October (CLIENT.md, "Light art": "The
// biggest at half size, unless asked" and "Names never reused"). A giant,
// the Fire Extreme Dragon, whose fight would take more than 128 MB on the
// graphics chip at full size, is kept at half size, while the Vulcano
// Dragon stays at full size; with Light art switched off, the giant is at
// full size too. Its pages are named by what they show. And a page that
// isn't the size its JSON says (a sheet made again since, or cut short)
// leaves its unit out rather than drawing the wrong pictures.
//
// Needs both dragons exported here with KTX2, the giant by today's packer
// (KTX2=1 tools/export_art.sh): skipped, and says so, without them.

import assert from "node:assert/strict";

const VULCANO = 847, FIRE = 2177;
const ART = { [VULCANO]: "847_vulcano_dragon", [FIRE]: "2177_fireExtremeDragon" };
const DRAGONS = [
  { cmd: "rt_level_up", args: [40] },
  { cmd: "buy", args: [VULCANO, 46, 46, 0, 0, 1, 1] },
  { cmd: "buy", args: [FIRE, 54, 50, 0, 0, 1, 1] },
];

/** Both dragons' map art: the sizes of its pages, against their sheets'. */
async function townArt(page) {
  await page.waitForFunction((ids) => ids.every((id) => {
    const { town, view } = window.seHome?.parts ?? {};
    const placed = town?.items.find((p) => p.item.id === id);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return picture?.texture?.source?.label?.includes(" in town");
  }), [VULCANO, FIRE], { timeout: 120_000 });
  return page.evaluate(async (arts) => {
    const { art } = window.seHome.parts;
    await art.settled();  // sharpened, where they come at half size first (progressive loading)
    const out = {};
    for (const name of arts) {
      const town = await art.unit(name);
      const sources = [...new Set([...town.animations.values()].flat().map((t) => t.source))];
      out[name] = { resolutions: [...new Set(sources.map((s) => s.resolution))], pages: sources.length };
    }
    return { arts: out, half: art.halfSize };
  }, Object.values(ART));
}

export default async function artRepair({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const metas = await page.evaluate(async (names) => Promise.all(names.map(async (name) => {
    const response = await fetch(`${window.seHome.parts.art.base}/${name}.json`);
    return response.ok ? (await response.json()).meta : null;
  })), Object.values(ART)).catch(() => []);
  if (metas.length < 2 || !metas.every((meta) => meta?.ktx2)) {
    console.log("  skipped: both dragons are needed with KTX2 pages (KTX2=1 tools/export_art.sh)");
    return;
  }
  // The giant, made by today's packer: its pages named by what they show.
  assert.match(metas[1].image, /^2177_fireExtremeDragon\.m2\.[0-9a-f]{12}\.webp$/);
  assert.ok(metas[1].related_multi_packs.every((name) => /^2177_fireExtremeDragon-\d+\.[0-9a-f]{12}\.json$/.test(name)));
  await player.send(DRAGONS);
  await player.reload();

  // A computer with room: the Vulcano Dragon at full size, the giant at half.
  const auto = await townArt(page);
  console.log(`  map pages: ${Object.entries(auto.arts).map(([name, a]) => `${name} ${a.pages} at ${a.resolutions}`).join(", ")}`);
  assert.equal(auto.half, false, "not light art: only the giant is halved");
  assert.deepEqual(auto.arts[ART[VULCANO]].resolutions, [1]);
  assert.deepEqual(auto.arts[ART[FIRE]].resolutions, [0.5], "the giant at half size");
  await player.shot("giant-half");

  // Light art switched off: every unit at full size, the giant too.
  await page.evaluate(() => localStorage.setItem("se-light-art", "off"));
  await player.reload();
  const off = await townArt(page);
  assert.deepEqual(off.arts[ART[FIRE]].resolutions, [1], "the giant at full size, as asked");
  await player.shot("giant-full");

  // A page that isn't the size its JSON says: the Vulcano Dragon's second town page, as an export cut short leaves it.
  await page.evaluate(() => localStorage.removeItem("se-light-art"));
  const warnings = [];
  page.on("console", (message) => message.type() === "warning" && warnings.push(message.text()));
  await page.route(/847_vulcano_dragon-1(\.[0-9a-f]+)?\.json$/, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.meta.size.w += 64;
    await route.fulfill({ response, json: data });
  });
  await player.reload();
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome?.parts ?? {};
    const placed = town?.items.find((p) => p.item.id === id);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    return picture?.texture?.source?.label?.includes(" in town");
  }, FIRE, { timeout: 120_000 });
  const stale = await page.evaluate((name) => window.seHome.parts.art.unit(name).then((art) => art === null), ART[VULCANO]);
  assert.ok(stale, "the unit is left out");
  assert.ok(warnings.some((text) => /where its JSON says/.test(text)), `a warning says why: ${warnings.join(" | ").slice(0, 300)}`);
  await player.shot("stale-left-out");
}
