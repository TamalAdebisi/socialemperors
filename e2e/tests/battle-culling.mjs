// Battles leave out what's off the screen too (CLIENT.md, "A busy town"):
// on a quest island, fighters far from the camera aren't drawn, and come
// back as the camera gets there or they walk into view; nothing on the
// screen is ever left out, while the army marches or the camera is zoomed
// all the way out. A raid on the town, drawn by the same view, the same.

import assert from "node:assert/strict";

const KNIGHT = 514, ARCHER = 518;

/** What's culled in a battle view, and any fighter culled that shows on the screen (all of its slot). */
function culling(page, hook) {
  return page.evaluate((hook) => {
    const view = hook === "quest" ? window.seQuest.view : window.seHome.fighting.view;
    const wrong = [];
    let culled = 0;
    for (const [fighter, { slot }] of view.drawn) {
      const box = slot.getBounds();
      const shows = box.width > 0 && box.x < innerWidth && box.x + box.width > 0 && box.y < innerHeight && box.y + box.height > 0;
      if (slot.culled) {
        culled++;
        if (shows) wrong.push(`${fighter.item.name} at ${fighter.tx},${fighter.ty}`);
      }
    }
    return { culled, drawn: view.drawn.size - culled, wrong };
  }, hook);
}

/** Once a frame has been drawn: culling is worked out just before drawing, and drawing in software can take a while here. */
const frame = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

export default async function battleCulling({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  // As quest.mjs: level 10 and an army, sailing to the first island.
  const army = [];
  for (let i = 0; i < 14; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 7), 44 + Math.floor(i / 7), 0, 0, 0, 1] });
  for (let i = 0; i < 6; i++) army.push({ cmd: "buy", args: [ARCHER, 44 + i, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.reload();
  await player.menu("Quests");
  await player.page.locator(".islands .island-button").nth(0).locator(".island-enter").click();
  await page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();

  // Landed: the far side of the island isn't drawn; all that shows is.
  await frame(page);
  const landed = await culling(page, "quest");
  assert.deepEqual(landed.wrong, [], "nothing on the screen is left out");
  assert.ok(landed.culled > 0, `the far side of the island isn't drawn (${landed.culled} of ${landed.culled + landed.drawn} left out)`);
  await player.shot("landed");

  // The camera to a fighter that was left out: drawn now.
  const far = await page.evaluate(() => {
    const { view, lookAt } = window.seQuest;
    const [fighter] = [...view.drawn].find(([, { slot }]) => slot.culled);
    lookAt({ x: fighter.tx, y: fighter.ty });
    return fighter.key;
  });
  await player.wait(300);
  await frame(page);
  assert.equal(await page.evaluate((key) => {
    const [, { slot }] = [...window.seQuest.view.drawn].find(([f]) => f.key === key);
    return slot.culled;
  }, far), false, "a fighter the camera goes to is drawn");
  assert.deepEqual((await culling(page, "quest")).wrong, [], "nothing on the screen left out after the camera moved");
  await player.shot("far-side");

  // The army marches to it: while they walk, nothing on the screen is left out.
  await page.evaluate((key) => {
    const { battle, select } = window.seQuest;
    const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
    const target = battle.fighters.find((f) => f.key === key);
    select(mine);
    for (const unit of mine) battle.walk(unit, { x: target.tx, y: target.ty });
  }, far);
  for (let look = 0; look < 8; look++) {
    await player.wait(400);
    await frame(page);
    assert.deepEqual((await culling(page, "quest")).wrong, [], `nothing on the screen left out as the army marches (look ${look + 1})`);
  }

  // Zoomed all the way out: most of the island shows, and all of that is drawn.
  const { width, height } = player.viewport;
  await page.mouse.move(width / 2, height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await player.wait(1200);
  await frame(page);
  const out = await culling(page, "quest");
  console.log(`  left out: ${landed.culled} of ${landed.culled + landed.drawn} as it landed, ${out.culled} zoomed out`);
  assert.deepEqual(out.wrong, [], "nothing on the screen left out, zoomed out");
  assert.ok(out.culled < landed.culled, `zoomed out, fewer left out (${out.culled}, ${landed.culled} as it landed)`);
  await player.shot("zoomed-out");

  // A raid on the town: drawn by the same view, the same.
  const home = await newPlayer();
  await home.page.waitForFunction(() => window.seHome);
  await home.page.evaluate(() => window.seHome.hurry());
  await home.page.waitForFunction(() => window.seHome.fighting);
  await home.page.evaluate(() => window.seHome.fighting.view.load(() => {}));
  await home.wait(1500);
  await frame(home.page);
  const raid = await culling(home.page, "home");
  assert.deepEqual(raid.wrong, [], "nothing on the screen left out in a raid");
  assert.ok(raid.culled + raid.drawn > 0, "the raid's fighters are drawn by the view");
  await home.shot("raid");
}
