// Survival (CLIENT.md, "Survival"): at level 20 the Battle window's
// Survival opens the game's window, its help shown the first time: three
// lives, Buy life, five arenas (two to play, three coming soon) with the
// units won for holding out. An arena opens the battle: the game's start
// window, Start uses a life, the 30 strongest units round the relic, the
// first wave from the edge with its line on the bar. When the relic falls,
// the results; OK sends the stand to the server, which keeps the best
// time, and the window shows it, a life fewer.

import assert from "node:assert/strict";

const KNIGHT = 514, EGYPT = 100000035;

export default async function survival({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const army = [];
  for (let i = 0; i < 20; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 10), 44 + Math.floor(i / 10), 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [20] }, ...army]);
  await player.reload();
  const info = async () => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json());
  const before = await info();

  // The window, its help the first time (and told to the server).
  await player.menu("Battle");
  const helpSent = page.waitForRequest((r) => r.url().endsWith("/command.php") && r.postData().includes("helpSurvival"), { timeout: 15_000 });
  await page.locator(".panel:not([hidden]) .row", { hasText: "Survival" }).locator("a").click();
  await page.waitForSelector(".survival-help-box");
  assert.match(await page.locator(".survival-help-box").textContent(), /SURVIVAL MODE!!.*Relic/s);
  await helpSent;
  await page.locator(".survival-help-box").getByRole("button", { name: "OK" }).click();
  assert.equal(await page.locator(".survival-hearts").getAttribute("aria-label"), "3 lives");
  assert.equal(await page.locator(".survival-arena").count(), 5);
  assert.equal(await page.locator(".survival-arena.locked").count(), 3, "three coming soon");
  assert.match(await page.locator(".survival-arena").first().textContent(), /Corrupted Egypt.*Available.*5 min.*15 min/s);
  await player.shot("window");

  // A life bought for 3 cash.
  await page.getByRole("button", { name: /Buy life for 3/ }).click();
  assert.equal(await page.locator(".survival-hearts").getAttribute("aria-label"), "4 lives");
  await player.wait(4500);
  const bought = await info();
  assert.equal(bought.privateState.survivalVidasExtra, 1);
  assert.equal(bought.playerInfo.cash, before.playerInfo.cash - 3);

  // The Egyptian arena: the start window, then Start uses a life.
  await page.getByRole("button", { name: "Play Corrupted Egypt" }).click();
  await page.waitForURL(new RegExp(`survival=${EGYPT}`));
  await page.waitForSelector(".quest-window h2", { timeout: 60_000 });
  assert.match(await page.locator(".quest-window h2").textContent(), /SURVIVAL MODE!!/);
  await player.press("Start");
  await page.waitForFunction(() => window.seSurvival, null, { timeout: 30_000 });
  await player.loaded();
  const start = await page.evaluate(() => {
    const { battle, survival, relic } = window.seSurvival;
    return { relic: relic.maxLife, mine: battle.fighters.filter((f) => f.side === 1 && f.isUnit).length, enemies: survival.enemies };
  });
  assert.equal(start.relic, 5000);
  assert.ok(start.mine > 0 && start.mine <= 30, `the army, 30 at most: ${start.mine}`);
  assert.equal(start.enemies, 8, "the first wave");
  assert.match(await page.locator(".survival-line").textContent(), /ENEMY WAVE 1 IS COMING!!!/);
  // The arena counts game time, which runs slowly without a graphics card.
  // Reach three seconds before ending the stand, as the saved-time check below needs.
  await page.waitForFunction(() => {
    const clock = document.querySelector('.survival-hud [aria-label="Time held"]')?.textContent?.match(/Time (\d+):(\d+)/);
    return clock && Number(clock[1]) * 60 + Number(clock[2]) >= 3;
  }, null, { timeout: 30_000 });
  assert.match(await page.locator(".survival-hud").textContent(), /Time 0:0[2-9].*Killed \d+.*Relic \d+\/5000/s);
  await player.shot("arena");
  const started = await info();
  assert.equal(started.privateState.survivalVidaTimeStamp.length, 1, "a life used");

  // The relic falls: the results, then the stand on the server.
  await page.evaluate(() => window.seSurvival.battle.kill(window.seSurvival.relic, null));
  await page.waitForSelector(".quest-window h2", { timeout: 15_000 });
  assert.match(await page.locator(".quest-window h2").textContent(), /Try it again/);
  assert.match(await page.locator(".quest-window").textContent(), /Your survival time was 0:0\d/);
  await player.shot("results");
  await player.press("OK");
  await page.waitForURL(/client\.html$/);
  await player.loaded();
  const after = await info();
  assert.ok(after.privateState.survivalMaps[EGYPT].tp >= 3, `the best time kept: ${JSON.stringify(after.privateState.survivalMaps[EGYPT])}`);

  // The window again: the best time, a life fewer (2 of the 3, and the one bought), the next one's countdown.
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Survival" }).locator("a").click();
  assert.equal(await page.locator(".survival-help-box").count(), 0, "the help only the first time");
  assert.equal(await page.locator(".survival-hearts").getAttribute("aria-label"), "3 lives");
  assert.match(await page.locator(".survival-next").textContent(), /Next life in 2:59:/);
  assert.match(await page.locator(".survival-arena").first().textContent(), /Best time: 0:0\d/);
}
