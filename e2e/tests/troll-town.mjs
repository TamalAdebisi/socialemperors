// The troll town (CLIENT.md, "The troll town"), as the Flash client's second
// town. A level 1 town has no Towns button; at level 20 it has, and the
// window offers a troll town for 100,000 gold or 22 cash. Founding it with
// cash sends buy_map and opens the troll town: a troll town, its own level,
// the shop's troll buildings, no goals. Its Towns window lists both, and
// Travel! goes home again. The server keeps two towns and the cash paid.

import assert from "node:assert/strict";

export default async function trollTown({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const towns = page.locator('.menus button[aria-label="Towns"]');
  assert.equal(await towns.count(), 0, "no Towns button below level 20");

  await player.send([{ cmd: "rt_level_up", args: [20] }]);
  await player.reload();
  const info = async () => (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  const cashBefore = (await info()).playerInfo.cash;
  assert.ok(cashBefore >= 22, `a level 20 test town has ${cashBefore} cash`);

  await towns.click();
  const window = page.locator(".panel.towns-window:not([hidden])");
  await window.waitFor();
  assert.equal((await window.locator("h2").textContent()).trim(), "Start a new Empire");
  assert.match(await window.locator(".town-picture").getAttribute("src"), /townTroll\.png$/);
  assert.ok(await player.button("Unlock for 100,000 gold").isVisible());
  await player.wait(800);
  await player.shot("offer");

  // Founding with cash: the troll town opens.
  await player.button("Unlock for 22 cash").click();
  await page.waitForURL(/[?&]town=1/, { timeout: 20_000 });
  await player.loaded();
  const troll = await page.evaluate(() => {
    const { race, id, level } = window.seHome.parts.town;
    return { race, id, level };
  });
  assert.deepEqual(troll, { race: "t", id: 1, level: 1 }, "the troll town, at its own level");
  assert.equal(await page.locator(".goal-card").count(), 0, "no goals in a troll town");
  await player.wait(1000);
  await player.shot("troll-town");

  await player.press("Build");
  await page.locator(".shop-card").first().waitFor();
  const names = await page.locator(".shop-name").allTextContents();
  assert.ok(names.some((name) => /troll/i.test(name)), `the shop sells troll buildings: ${names.slice(0, 6).join(", ")}`);
  await page.keyboard.press("Escape");

  const saved = await info();
  assert.equal(saved.privateState.maps.length, 2, "two towns on the server");
  assert.equal(saved.playerInfo.cash, cashBefore - 22, "22 cash paid");

  // The troll town's Towns window: both, and Travel! home.
  await towns.click();
  await window.waitFor();
  assert.equal((await window.locator("h2").textContent()).trim(), "SELECT TOWN");
  assert.equal(await window.locator(".town-row").count(), 2);
  assert.ok(await window.getByRole("button", { name: /you're here/ }).isDisabled());
  await player.shot("towns");
  await window.getByRole("button", { name: /^Travel to/ }).click();
  await page.waitForURL(/[?&]town=0/, { timeout: 20_000 });
  await player.loaded();
  assert.equal(await page.evaluate(() => window.seHome.parts.town.race), "h", "home again");
}
