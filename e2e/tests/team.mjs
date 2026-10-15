// A team (CLIENT.md, "Quests"): God Isle 1 takes a team of 20 with at
// least one god or colossus. Starting with nobody picked, or with knights
// only, says why not; with the Fire God picked, fewer than 20 asks once,
// then the team alone lands, and the server keeps it. Going home at once
// counts as left early.

import assert from "node:assert/strict";

const KNIGHT = 514, FIRE_GOD = 2075, GOD_ISLE = 100000090;

export default async function team({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 6; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 44, 0, 0, 0, 1] });
  army.push({ cmd: "buy", args: [FIRE_GOD, 48, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.page.goto(`${player.base}/client.html?quest=${GOD_ISLE}`);
  await player.page.waitForSelector(".quest-team", { timeout: 60_000 });
  assert.match(await player.page.locator(".quest-window").textContent(), /Pick your team: 0 of 20/);
  await player.shot("picker");

  // Nobody; then knights only: not allowed.
  await player.press("Start battle");
  assert.match(await player.page.locator(".quest-problem").textContent(), /Pick the units/);
  await player.page.getByRole("button", { name: "Add a Heavy Knight" }).click();
  await player.page.getByRole("button", { name: "Add a Heavy Knight" }).click();
  await player.press("Start battle");
  assert.match(await player.page.locator(".quest-problem").textContent(), /at least 1 god/);
  // Taking one out, and the god in.
  await player.page.getByRole("button", { name: "Take out a Heavy Knight" }).first().click();
  await player.page.getByRole("button", { name: "Add a Elemental Fire God" }).click();
  assert.match(await player.page.locator(".quest-window").textContent(), /Pick your team: 2 of 20/);
  await player.shot("picked");
  // Fewer than 20: asked once.
  await player.press("Start battle");
  assert.match(await player.page.locator(".quest-problem").textContent(), /Only 2 of 20/);
  await player.press("Start battle");
  await player.loaded();
  const landed = await player.page.evaluate(() => window.seQuest.battle.fighters
    .filter((f) => f.side === 1 && f.isUnit && !f.free).map((f) => f.item.id).sort((a, b) => a - b));
  assert.deepEqual(landed, [KNIGHT, FIRE_GOD].sort((a, b) => a - b), "the team alone lands");
  await player.shot("landed");

  // The server keeps the team.
  await player.wait(1500);
  const settings = JSON.parse(await player.page.locator("#se-settings").textContent());
  const info = await (await player.page.request.post(`${player.base}${settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: settings.userId, user_key: settings.userKey } })).json();
  const saved = info.privateState.teams.quest.filter((id) => id > 0).sort((a, b) => a - b);
  assert.deepEqual(saved, [KNIGHT, FIRE_GOD].sort((a, b) => a - b));
  assert.equal(info.privateState.teams.quest.length, 20);

  // Home at once: left early, lost.
  await player.page.locator(".quest-home").click();
  await player.press("Leave");
  await player.page.waitForSelector(".quest-window h2", { timeout: 15_000 });
  assert.equal((await player.page.locator(".quest-window h2").textContent()).trim(), "You left the island.");
}
