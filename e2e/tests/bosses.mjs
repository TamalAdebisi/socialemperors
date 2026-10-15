// A boss island (CLIENT.md, "Quests"): the Arctic Isle. An army sails
// there with the island's lent Wizard and knights. The guards nearest the
// landing are fought for real until their key lights up; one tap collects
// it (penguins join, the counter goes down, the gate's picture steps on).
// The other guards fall by the test's hand and their keys are collected:
// the gate goes. The yeti's fall wins; the server has the star and the
// island's prize.

import assert from "node:assert/strict";

const KNIGHT = 514, FIRE_GOD = 2075, ARCTIC = 100000002, BEFORE = 100000008, PENGUIN = 546, PRIZE = 541;

export default async function bosses({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 2; i++) army.push({ cmd: "buy", args: [FIRE_GOD, 44 + 2 * i, 48, 0, 0, 0, 1] });
  for (let i = 0; i < 20; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 10), 44 + Math.floor(i / 10), 0, 0, 0, 1] });
  // The island before it won, as the Flash client reports a win: the Arctic Isle opens.
  const won = { map: 0, resources: { g: 0, x: 0 }, units: [], win: 1, duration: 60, voluntary_end: 0, quest_id: BEFORE, difficulty: 1 };
  await player.send([{ cmd: "rt_level_up", args: [12] }, ...army, { cmd: "end_quest", args: [JSON.stringify(won)] }]);
  await player.page.goto(`${player.base}/client.html?quest=${ARCTIC}`);
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();

  // Four keys to collect; the gate shut; the yeti's life from the level.
  assert.match(await player.page.locator(".quest-hud").textContent(), /4 keys to collect/);
  const start = await state(player);
  assert.ok(!start.gateWalkable && start.gateStill === 0, JSON.stringify(start));
  assert.deepEqual(start.yeti, [8000], "level 10 to 14");
  assert.equal(start.lent, 5, "the Wizard and four knights");

  // The first group, fought for real.
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  for (let tries = 0; ; tries++) {
    const left = await player.page.evaluate(() => {
      const { battle, quest } = window.seQuest;
      const group = [...quest.boss.groups[0]];
      if (group.length === 0) return 0;
      const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
      if (!mine.some((f) => f.target || f.next)) battle.attackWith(mine, group[0]);
      return group.length;
    });
    if (left === 0) break;
    if (tries % 10 === 0) console.log(`  (${left} guards left by the first key)`);
    assert.ok(tries < 120, `the first group still holds ${left} after ${tries} orders`);
    await player.wait(1500);
  }
  // Its key, lit: a tap collects it.
  await player.page.evaluate(() => { const k = window.seQuest.quest.boss.keys[0]; window.seQuest.lookAt({ x: k.tx, y: k.ty }); });
  await player.wait(800);
  await player.shot("key-lit");
  const at = await player.page.evaluate(() => window.seQuest.screenOf(window.seQuest.quest.boss.keys[0]));
  await player.click(at);
  await player.wait(500);
  assert.match(await player.page.locator(".quest-hud").textContent(), /3 keys to collect/);
  const one = await state(player);
  assert.equal(one.penguins, 3, "three penguins join");
  assert.equal(one.gateStill, 1, "the gate's picture steps on");

  // The rest by the test's hand: the gate goes.
  await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    for (const group of quest.boss.groups) for (const guard of [...group]) battle.kill(guard, null);
    for (const key of [...quest.boss.keys]) if (key) quest.collect(key);
  });
  await player.wait(500);
  assert.match(await player.page.locator(".quest-hud").textContent(), /Beat the boss!/);
  assert.ok((await state(player)).gateWalkable, "the gate is gone");

  // The yeti falls: won.
  await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    for (const boss of quest.boss.bosses) battle.kill(boss, null);
  });
  await player.page.waitForSelector(".quest-window h2", { timeout: 30_000 });
  assert.equal((await player.page.locator(".quest-window h2").textContent()).trim(), "Victory!");
  await player.wait(1500);
  const info = await (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(info.privateState.questsRank[ARCTIC], 1, "one star won");
  // The server keeps gifts counted by item id.
  assert.ok(Number(info.privateState.gifts?.[PRIZE] ?? 0) >= 1, "the island's prize: a Powerful Knight");
}

/** The gate, the yeti and the player's side, as the battle has them. */
function state(player) {
  return player.page.evaluate(({ penguin }) => {
    const { battle, quest } = window.seQuest;
    const grid = battle.walkGrid();
    const gate = quest.boss.door;
    return {
      gateWalkable: grid[83 * 100 + 77] === 1,
      gateStill: gate ? gate.still : null,
      yeti: quest.boss.bosses.map((b) => b.maxLife),
      lent: battle.fighters.filter((f) => f.free && f.item.id !== penguin).length,
      penguins: battle.fighters.filter((f) => f.item.id === penguin && f.side === 1).length,
    };
  }, { penguin: PENGUIN });
}
