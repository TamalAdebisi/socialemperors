// The God Isles with a colossus the game's data doesn't tag "colossus"
// (CLIENT.md, "Quests"; DECISIONS.md). A level 10 town whose only big
// unit is a Rodas Colossus finds God Isle 1 open on the island map and
// sails: a team of knights alone is turned away, the colossus with them
// lands. The server keeps the team.

import assert from "node:assert/strict";

const KNIGHT = 514, RODAS_COLOSSUS = 764, GOD_ISLE = 100000090;

export default async function godColossus({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 3; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 44, 0, 0, 0, 1] });
  army.push({ cmd: "buy", args: [RODAS_COLOSSUS, 48, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.reload();

  // The island map: God Isle 1 is open from the start, its Enter button there.
  await player.menu("Quests");
  const isle = player.page.locator(".islands .island-button", { hasText: "God Isle 1" });
  await isle.waitFor({ state: "attached" });
  assert.match(await isle.getAttribute("href"), new RegExp(`quest=${GOD_ISLE}`), "God Isle 1 can be sailed to");
  // The map opens at the first island; the God Isles are on its last page.
  const enter = isle.locator(".island-enter");
  for (let page = 0; page < 7 && !(await enter.isVisible() && await inView(player.page, enter)); page++) {
    await player.page.getByRole("button", { name: "Next page" }).click();
    await player.wait(800);
  }
  await player.shot("map");
  await enter.click();

  // The team: knights alone may not sail; with the Rodas Colossus they may.
  await player.page.waitForSelector(".quest-team", { timeout: 60_000 });
  await player.page.getByRole("button", { name: "Add a Heavy Knight" }).click();
  await player.press("Start battle");
  assert.match(await player.page.locator(".quest-problem").textContent(), /at least 1 god/);
  await player.page.getByRole("button", { name: "Add a Rodas Colossus" }).click();
  assert.match(await player.page.locator(".quest-window").textContent(), /Pick your team: 2 of 20/);
  await player.shot("picked");
  await player.press("Start battle");
  assert.match(await player.page.locator(".quest-problem").textContent(), /Only 2 of 20/);
  await player.press("Start battle");
  await player.loaded();
  const landed = await player.page.evaluate(() => window.seQuest.battle.fighters
    .filter((f) => f.side === 1 && f.isUnit && !f.free).map((f) => f.item.id).sort((a, b) => a - b));
  assert.deepEqual(landed, [KNIGHT, RODAS_COLOSSUS], "the knight and the colossus land");
  await player.shot("landed");

  // The server keeps the team.
  await player.wait(1500);
  const settings = JSON.parse(await player.page.locator("#se-settings").textContent());
  const info = await (await player.page.request.post(`${player.base}${settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: settings.userId, user_key: settings.userKey } })).json();
  assert.deepEqual(info.privateState.teams.quest.filter((id) => id > 0).sort((a, b) => a - b), [KNIGHT, RODAS_COLOSSUS]);
}

/** Whether a picture on the map is inside the sea's visible part. */
async function inView(page, locator) {
  const box = await locator.boundingBox();
  const sea = await page.locator(".island-sea").boundingBox();
  return Boolean(box && sea && box.x >= sea.x && box.x + box.width <= sea.x + sea.width);
}
