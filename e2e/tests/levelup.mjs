// The level-up window (CLIENT.md, "Step 3: run your town"), as the Flash
// client's: a flag's 100 experience takes a town from level 2 past levels 3
// and 4 at once, and a window for each follows the other: the level, its
// rank, the buildings it opens (the game's thumbnails), its reward. The
// save has both levels and both rewards.

import assert from "node:assert/strict";

const FLAG = "Argentina Flag", FLAG_AT = [56, 55];

export default async function levelUp({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  // Two level ups' prizes give a little cash (for the flag); then the experience goes back to 59: level 2.
  // (The flag costs cash, so the food and wood the windows show come only from the levels.)
  await player.send([
    { cmd: "rt_level_up", args: [5] },
    { cmd: "rt_level_up", args: [6] },
    { cmd: "rt_publish_score", args: [59] },
  ]);
  await player.reload();
  const before = await player.saved({ waitForBatch: false });
  assert.equal(before.level, 2);
  const mine = await page.evaluate(() => ({ food: window.seHome.parts.town.food, wood: window.seHome.parts.town.wood }));

  await player.press("Build");
  await player.press("Decorations");
  await player.wait(500);
  await player.card(FLAG).click();
  await player.wait(300);
  await player.tapTile(FLAG_AT);
  if (await player.button("Done").isVisible()) await player.press("Done");

  const window = page.locator(".level-window");
  const shown = async () => ({
    title: (await window.locator(".level-band").textContent()).trim(),
    rank: (await window.locator(".level-rank").textContent()).trim(),
    unlocked: await window.locator(".level-unlocked figcaption").allTextContents(),
    reward: (await window.locator(".level-reward").textContent()).replace(/\s+/g, " ").trim(),
  });
  await window.waitFor({ timeout: 10_000 });
  const three = await shown();
  assert.equal(three.title, "LEVEL 3!");
  assert.equal(three.rank, "You've reached Peon rank");
  assert.match(three.reward, /^Level reward:\s*50$/);
  assert.ok(await window.locator('.level-reward img[alt="food"]').count() === 1, "food's icon");
  assert.ok(three.unlocked.length <= 4);
  await player.wait(1500);  // the thumbnails come in
  await player.shot("level-3");

  await page.locator(".level-ok").click();
  const four = await shown();
  assert.equal(four.title, "LEVEL 4!", "then the next level's window");
  assert.match(four.reward, /^Level reward:\s*400$/);
  assert.ok(four.unlocked.length > 0 && four.unlocked.length <= 4, "level 4 opens buildings");
  await player.wait(1000);
  await player.shot("level-4");
  await page.locator(".level-ok").click();
  assert.equal(await window.count(), 0, "no more windows");

  // The prizes are the player's at once (the server had paid these two levels already, before the
  // test set the experience back: it doesn't pay twice, so they're checked on the page).
  const after = await page.evaluate(() => ({ food: window.seHome.parts.town.food, wood: window.seHome.parts.town.wood }));
  assert.equal(after.food - mine.food, 50, "level 3's 50 food");
  assert.equal(after.wood - mine.wood, 400, "level 4's 400 wood");
  assert.equal((await player.saved()).level, 4, "the save has level 4");

  // On a phone: the same window fits.
  const phone = await player.onPhone();
  await phone.page.evaluate(() => window.seLevels.show([{ level: 5, name: "Villager", prize: { resource: "cash", amount: 2 }, unlocked: [], mana: 0 }]));
  await phone.wait(500);
  await phone.shot("phone");
  const box = await phone.page.locator(".level-window").boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, "within the phone's width");
}
