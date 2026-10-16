// A goal's own window (CLIENT.md, "Missions and bonuses"), as the Flash
// client's "Goal INFO". A new town's box says "New Mission!" (below level 8,
// once Arthur's lessons are skipped); the goal card opens goal 1's window:
// its title, text, the game's picture of the steps and a child, its gold,
// OK and HELP!, which points the game's arrow at the Build menu. Goals opens
// the list, whose +INFO opens a goal's window again. With goals 1 to 5 done
// and paid, goal 6's card says "Click here!" until tapped, and its window
// has no HELP! (it builds nothing). On a phone the window fits.

import assert from "node:assert/strict";

export default async function goalWindow({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const card = page.locator(".goal-card").first();
  const window = page.locator(".goal-window");

  // The notice by the box.
  await page.locator(".goal-new-mission").waitFor({ timeout: 6000 });

  await card.click();
  await window.waitFor();
  assert.equal((await window.locator(".goal-band").textContent()).trim(), "Goal INFO");
  assert.equal((await window.locator(".goal-name").textContent()).trim(), "Build farm land");
  assert.ok((await window.locator(".goal-text").textContent()).length > 20, "the goal's text");
  assert.match(await window.locator(".goal-picture").getAttribute("src"), /goal_001\.jpg$/);
  assert.match(await window.locator(".goal-figure").getAttribute("src"), /nino_01\.png$/);
  assert.match((await window.locator(".goal-prize").textContent()).replace(/\s+/g, " "), /^Reward: \d+$/);
  assert.ok(await page.locator(".goal-new-mission").isHidden(), "the notice goes once a goal is looked at");
  await player.wait(1500);  // the pictures come in
  await player.shot("window");

  // HELP!: the window goes, the arrow points at the Build menu.
  await window.getByRole("button", { name: "HELP!" }).click();
  assert.equal(await window.count(), 0);
  const arrow = page.locator(".help-arrow");
  await arrow.waitFor();
  const build = await page.locator('.menus button[aria-label="Build"]').boundingBox();
  const transform = await arrow.evaluate((a) => a.style.transform);
  const [x, y] = transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/).slice(1).map(Number);
  assert.ok(Math.abs(x - (build.x + build.width / 2)) < 2 && Math.abs(y - (build.y + build.height / 2)) < 2, "at the Build menu");
  await player.shot("help");
  await page.locator('.menus button[aria-label="Build"]').click();
  assert.equal(await arrow.count(), 0, "gone once followed");
  await page.keyboard.press("Escape");

  // Goals: the list; +INFO: a goal's window again.
  await card.click();
  await window.getByRole("button", { name: "Goals" }).click();
  const list = page.locator(".panel.goals-window:not([hidden])");
  await list.waitFor();
  const infos = list.locator(".goal-info");
  assert.ok(await infos.count() >= 10, "+INFO on the goals not done");
  await infos.nth(1).click();
  await window.waitFor();
  const second = (await window.locator(".goal-name").textContent()).trim();
  assert.notEqual(second, "Build farm land");
  await page.keyboard.press("Escape");
  assert.equal(await window.count(), 0, "Escape closes it");

  // Goals 1 to 5 done and paid: goal 6 says "Click here!", until tapped; it has no HELP!.
  const done = [1, 2, 3, 4, 5].flatMap((id) => [{ cmd: "complete_mission", args: [id, 0] }, { cmd: "reward_mission", args: [0, id] }]);
  await player.send(done);
  await player.reload();
  const badge = page.locator(".goal-click-here");
  await badge.waitFor({ timeout: 6000 });
  assert.equal((await badge.textContent()).trim(), "Click here!");
  await player.shot("click-here");
  await card.click();
  await window.waitFor();
  assert.equal(await badge.count(), 0, "the tag goes once tapped");
  assert.equal(await window.getByRole("button", { name: "HELP!" }).count(), 0, "zooming builds nothing: no HELP!");
  await page.keyboard.press("Escape");

  // On a phone: the window fits.
  const phone = await player.onPhone();
  await phone.page.locator(".goal-card").first().click();
  await phone.page.locator(".goal-window").waitFor();
  await phone.wait(1000);
  await phone.shot("phone");
  const box = await phone.page.locator(".goal-window").boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, "within the phone's width");
}
