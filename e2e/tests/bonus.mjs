// Goals and the daily bonus (CLIENT.md, "Missions and bonuses"): a new
// town's first goal is to build a farm; one bought through the shop reaches
// it, and its 10 gold is paid. The daily bonus is offered from level 5, as in
// the Flash client: day 1's 250 gold. Goals can't be skipped for cash (the
// Flash client had that switched off). The save has the goal done and paid,
// and the bonus's day.

import assert from "node:assert/strict";

export default async function bonus({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const gold = async () => Number((await page.locator('[data-n="gold"]').textContent()).replace(/,/g, ""));
  const info = async () => (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();

  // The next goal shows bottom left.
  assert.match(await page.locator(".goal-card").first().textContent(), /^Build farm land/);
  await player.shot("goal");

  // No daily bonus below level 5; at level 5 it's on offer.
  assert.equal(await player.button("Daily bonus").count(), 0, "not at level 1");
  await player.send([{ cmd: "rt_level_up", args: [5] }]);
  await player.reload();

  // The daily bonus: on offer, day 1 is today, 250 gold.
  await player.press("Daily bonus");
  assert.match(await page.locator(".bonus-days li.today").textContent(), /Today.*250 gold/);
  await player.shot("daily-bonus");
  const before = await gold();
  await player.press("Collect");
  assert.equal(await gold(), before + 250);
  assert.equal(await player.button("Daily bonus").count(), 0, "collected: no longer on offer");
  await page.keyboard.press("Escape");

  // A farm through the shop reaches the first goal; its gold comes at the next check.
  await player.menu("Build");
  await player.press("Resources");
  await player.card("Farm Land").click();
  await player.tapTile([56, 56]);
  await player.press("Done");
  await player.said(/Goal reached: Build farm land! \+10 gold/);

  // The goals window: no Skip.
  await page.locator(".goal-card").first().click();
  await player.wait(300);
  assert.equal(await page.locator(".goals-window .goal-row button").count(), 0, "no Skip buttons");
  await player.shot("goals");
  await page.keyboard.press("Escape");

  await player.saved();
  const saved = await info();
  assert.ok(saved.privateState.completedMissions.includes(1), "goal 1 is done in the save");
  assert.ok(saved.privateState.rewardedMissions.includes(1), "and paid");
  assert.equal(saved.privateState.bonusNextId, 2, "the daily bonus's next day is the 2nd");
  assert.ok(saved.map.coins >= 250 + 10, "250 for the bonus and 10 for the goal, less the farm's price in wood");
}
