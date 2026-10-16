// Spying (CLIENT.md, "Attacking players"): with Eagles I built, the world
// map shows the eagles left and an island's menu has Spy. The spy visit
// starts with the game's own words, then the player's eagle alone (life
// 200 with Eagles I) flies over their town wherever it's tapped, with no
// spell book and nothing to attack; the server has the visit (spy_player).
// Called home, the visit ends and the world map opens again at that
// continent, one eagle fewer.

import assert from "node:assert/strict";

const EAGLES_I = 185, EAGLE = 543;

export default async function spy({ newPlayer }) {
  const rival = await newPlayer();
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "rt_level_up", args: [10] }, { cmd: "buy", args: [EAGLES_I, 40, 56, 0, 0, 1, 1] }]);
  await player.reload();

  // The map: the eagles left, and Spy on the rival's island.
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Attack a player" }).locator("a").click();
  await page.waitForSelector(".world-map:not(.loading) .world-island", { timeout: 30_000 });
  assert.match(await page.locator(".world-attacks").nth(1).textContent(), /Eagles Left: 3/);
  await page.locator(".world-island", { has: page.locator(".world-name", { hasText: rival.name }) }).click();
  const link = page.getByRole("link", { name: `Spy on ${rival.name}` });
  assert.match(await link.getAttribute("href"), new RegExp(`spy=${rival.settings.userId}.*continent=1`));
  await link.click();

  // The game's words, then the eagle over their town.
  await page.waitForSelector(".quest-window h2", { timeout: 60_000 });
  assert.match(await page.locator(".quest-window h2").textContent(), /Preparing To SPY/);
  await player.press("Start Spying");
  await page.waitForFunction(() => window.seAttack, null, { timeout: 60_000 });
  await player.loaded();
  const mine = await page.evaluate(() => window.seAttack.battle.fighters.filter((f) => f.side === 1)
    .map((f) => ({ id: f.item.id, life: f.maxLife, attack: f.attack })));
  assert.deepEqual(mine, [{ id: EAGLE, life: 200, attack: 0 }], "the eagle alone, Eagles I's life, nothing to attack with");
  assert.equal(await page.getByRole("button", { name: "Select all" }).count(), 0);
  assert.equal(await page.locator(".spell-book-button").count(), 0, "no spells while spying");
  assert.match(await page.locator(".quest-hud").textContent(), /\d+ targets?(?! left)/);

  // A tap sends it there.
  const { width, height } = player.viewport;
  await player.click({ x: width / 2 + 120, y: height / 2 + 60 });
  await player.wait(400);
  assert.ok(await page.evaluate(() => window.seAttack.battle.fighters.some((f) => f.side === 1 && (f.next || f.path.length))),
    "the eagle flies");
  await player.wait(1500);
  await player.shot("spying");
  const saved = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(saved.privateState.spyings.length, 1, "the visit is on the server");
  assert.equal(saved.privateState.spyings[0].victim_id, String(rival.settings.userId));

  // Called home: back to the map at that continent, one eagle fewer.
  await page.getByRole("button", { name: "Call the eagle home" }).click();
  await player.press("Come home");
  await page.waitForSelector(".quest-window h2", { timeout: 15_000 });
  assert.match(await page.locator(".quest-window h2").textContent(), /Your eagle is back home/);
  await player.press("Back home");
  await page.waitForURL(/client\.html\?world=1$/);
  await player.loaded();
  await page.waitForSelector(".world-map:not(.loading) .world-island", { timeout: 30_000 });
  assert.match(await page.locator(".world-attacks").nth(1).textContent(), /Eagles Left: 2/);
  assert.match(await page.locator(".world-attacks").first().textContent(), /3/, "spying uses no attack");
  await player.shot("back");
}
