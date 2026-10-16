// Arthur's lessons (CLIENT.md, "Arthur's lessons"), played as a player
// would, by following Arthur's arrow: a villager trained, walked and sent at
// a tree; House I built; a knight sent at a troll; then the goals: a farm,
// a villager into it, its food collected, three trees cut. Each step is
// reported to the server. A reload part way carries on. At the end the town
// has the dragon nest (its first egg at 7 of 10, no wait) and the draggy
// chosen in the game's window.

import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";

const NEST = 1233, GREEN_DRAGGY = 698;

export default async function lessons({ newPlayer, phone = false }) {
  const player = await newPlayer({ lessons: true, wild: true, camp: true, dock: true, ...(phone ? { phone: true, viewport: PHONE } : {}) });
  const { page } = player;
  if (phone) player.click = async (at) => { await page.touchscreen.tap(at.x, at.y); await player.wait(250); };
  const step = () => page.evaluate(() => window.seLessons?.at ?? -1);
  const reach = async (n, timeout = 30_000) => {
    await page.waitForFunction((n) => (window.seLessons?.at ?? -1) >= n, n, { timeout });
    console.log(`  tutorial step ${n}`);
    await page.waitForFunction(() => document.querySelector(".lesson")?.dataset.moving !== "true");
  };
  /**
   * A tap where Arthur's arrow points; every one moves the lessons on. A tap
   * that changed nothing is tried once more, as a player would: now and then
   * Chromium loses one on a busy machine.
   */
  const follow = async () => {
    const before = await step();
    for (let tries = 0; tries < 2; tries++) {
      await page.waitForFunction(() => window.seLessons.pointing && document.querySelector(".lesson")?.dataset.moving === "false", null, { timeout: 30_000 });
      const at = await page.evaluate(() => window.seLessons.pointing);
      assert.ok(at, `the arrow points somewhere (step ${before})`);
      await player.click(at);
      const moved = await page.waitForFunction((n) => window.seLessons.at !== n, before, { timeout: 3000 }).then(() => true, () => false);
      if (moved) break;
    }
    await player.wait(300);
  };

  assert.equal(await page.getByRole("button", { name: "Skip them" }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Classic game" }).count(), 0);
  await reach(0);
  assert.match(await page.locator(".lesson-title").textContent(), /Welcome to your empire/);
  await player.shot("welcome");
  await player.press("Next");

  // The villager.
  await reach(1);
  await follow();  // the town hall
  await reach(2);
  if (!phone) {
    await page.evaluate(() => window.seHome.parts.commands.flush());
    await player.reload();
    await reach(2);
    await page.keyboard.press("Escape");
    await player.press("Show me");
  }
  await follow();  // its Train button
  await reach(3, 20_000);
  const villagers = () => window.seHome.parts.town.items.filter((p) => p.item.subcategory === 71 && p.tx >= 40 && p.ty >= 40).length;
  await page.waitForFunction(villagers, null, { timeout: 30_000 });
  await player.wait(1000);
  await follow();  // the villager
  await reach(4);
  assert.equal(await page.locator(".lesson-target").textContent(), "Move here");
  await player.shot("move-here");
  await player.click(await page.evaluate(() => window.seLessons.pointing));  // the ground beside the town hall
  await reach(5);
  await follow();  // a tree
  await reach(6);
  await reach(8, 90_000);  // it falls; the wood is the player's at once

  // The house.
  await follow();  // BUILD
  await reach(9);
  await follow();  // House I in the shop
  await reach(10);
  await page.keyboard.press("Escape");
  await player.press("Show me");
  await reach(10);
  await follow();  // where the house goes
  await reach(11);
  assert.equal(await page.evaluate(() => window.seHome.parts.editor.lessonBuilding), null, "placing mode closes automatically");

  // The first fight.
  await follow();  // a knight
  await reach(12);
  await follow();  // a troll
  await reach(13);
  await reach(14, 90_000);  // the first to fall
  await player.press("Next");

  // A reload part way: the lessons carry on.
  await reach(15);
  let saved = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  await player.wait(3500);
  await player.reload();
  await reach(15, 30_000);

  // The goals: the farm.
  await follow();  // the goals
  await reach(16);
  await follow();  // read, and closed
  await reach(17);
  await follow();  // BUILD
  await reach(18);
  await follow();  // Farm Land
  await reach(19);
  await follow();  // where the farm goes
  await reach(22);
  await follow();  // the town hall
  await reach(23);
  await follow();  // Train
  await reach(24, 20_000);
  await page.waitForFunction(() => window.seHome.parts.town.items.filter((p) => p.item.subcategory === 71 && p.tx >= 40 && p.ty >= 40).length >= 2,
    null, { timeout: 30_000 });
  await player.wait(1000);
  await follow();  // the new villager
  await reach(25);
  await page.waitForFunction(() => window.seLessons.pointing && document.querySelector(".lesson")?.dataset.moving === "false");
  await follow();  // the farm
  await reach(26);
  if (!phone) {
    await page.waitForFunction(() => window.seHome.parts.town.items.some((p) => p.item.subcategory === 122 && p.unitsInside > 0));
    await page.evaluate(() => window.seHome.parts.commands.flush());
    await player.reload();
    assert.ok(await step() >= 26, "a working farm resumes without another worker purchase");
  }
  await reach(27, 90_000);  // the crop ready
  await follow();  // collect it
  await reach(30);
  await follow();  // a villager
  await reach(31);
  await player.shot("trees");
  await player.click(await page.evaluate(() => window.seLessons.pointing));  // the marked trees (the last step stays till three fall)

  // Three trees down: the nest, and the draggy.
  await page.waitForSelector(".draggy-window.choose", { timeout: 180_000 });
  await page.evaluate(() => window.seHome.parts.commands.flush());
  const pending = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  assert.equal((await pending.json()).privateState.tutorial.step, 32, "the reward choice is saved as unfinished");
  await page.evaluate(() => localStorage.clear());
  await player.reload();
  await page.waitForSelector(".draggy-window.choose");
  await page.waitForFunction(() => [...document.querySelectorAll(".draggy-slot img")].every((i) => i.naturalWidth > 0), null, { timeout: 15_000 });
  await player.shot("draggy");
  await page.getByRole("button", { name: "Select Green Draggy" }).click();
  await page.waitForSelector(".draggy-window.reminder", { timeout: 10_000 });
  await page.locator(".draggy-ok").click();
  await player.wait(4000);
  saved = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  const info = await saved.json();
  assert.equal(Number(info.playerInfo.completed_tutorial), 33, "reward saved before completion");
  assert.deepEqual(info.privateState.tutorial, { step: 33, trees: 3, draggy: GREEN_DRAGGY });
  assert.equal(info.map.items.filter((i) => i[0] === NEST).length, 1, "the dragon nest");
  assert.equal(info.map.items.filter((i) => i[0] === GREEN_DRAGGY).length, 1, "the draggy chosen");
  assert.equal(info.privateState.stepNumber, 7, "the first egg at 7 of 10");
  assert.ok(!(Number(info.privateState.timeStampTakeCare) > 0), "and no wait");
  await player.reload();
  assert.equal(await player.bar(), "", "the lessons don't come back");
  assert.equal(await page.locator(".lesson").count(), 0);
}
