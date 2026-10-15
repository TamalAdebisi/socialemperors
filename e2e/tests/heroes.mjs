// The Hero Isle (CLIENT.md, "Quests"): its heroes wait in parts walled off
// by doors. An army sails there, fights the first part's heroes, and that
// part's door opens: its open picture, and the army can walk through it.
// The rest are struck down by the test's hand, which wins the island; the
// server has the star.

import assert from "node:assert/strict";

const KNIGHT = 514, FIRE_GOD = 2075, HERO_ISLE = 100000018;

export default async function heroes({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 2; i++) army.push({ cmd: "buy", args: [FIRE_GOD, 44 + 2 * i, 48, 0, 0, 0, 1] });
  for (let i = 0; i < 20; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 10), 44 + Math.floor(i / 10), 0, 0, 0, 1] });
  // The island before it won, as the Flash client reports a win: the Hero Isle opens.
  const before = { map: 0, resources: { g: 0, x: 0 }, units: [], win: 1, duration: 60, voluntary_end: 0, quest_id: 100000019, difficulty: 1 };
  await player.send([{ cmd: "rt_level_up", args: [30] }, ...army, { cmd: "end_quest", args: [JSON.stringify(before)] }]);
  await player.page.goto(`${player.base}/client.html?quest=${HERO_ISLE}`);
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();

  // Seven doors, all shut: their closed picture, and nobody walks through.
  const shut = await doors(player);
  assert.equal(shut.length, 7);
  assert.ok(shut.every((d) => !d.open && d.facing === 0 && !d.walkable), JSON.stringify(shut));
  assert.match(await player.page.locator(".quest-hud").textContent(), /47 enemies left/, "every hero to beat");

  // The first part's heroes, fought for real, at speed.
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  for (let tries = 0; ; tries++) {
    const left = await player.page.evaluate(() => {
      const { battle, quest } = window.seQuest;
      if (quest.zoneLeft[0] <= 0) return 0;
      const [x1, y1, x2, y2] = quest.island.doorZones[0];
      const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
      const enemy = battle.fighters.find((f) => f.side === 2 && f.isUnit && !f.dead && f.tx >= x1 && f.tx <= x2 && f.ty >= y1 && f.ty <= y2);
      if (enemy && !mine.some((f) => f.target || f.next)) battle.attackWith(mine, enemy);
      return quest.zoneLeft[0];
    });
    if (left <= 0) break;
    if (tries % 10 === 0) console.log(`  (${left} left in the first part)`);
    assert.ok(tries < 120, `the first part still holds ${left} after ${tries} orders`);
    await player.wait(1500);
  }
  await player.wait(500);
  const after = await doors(player);
  assert.ok(after[0].open && after[0].facing === 2 && after[0].walkable, `the first door opened: ${JSON.stringify(after[0])}`);
  assert.ok(after.slice(1).every((d) => !d.open), "the others still shut");
  await player.page.evaluate(() => { const d = window.seQuest.quest.doors[0]; window.seQuest.lookAt({ x: d.tx, y: d.ty }); });
  await player.wait(800);
  await player.shot("door-open");

  // The rest struck down: the island is won.
  await player.page.evaluate(() => {
    const { battle } = window.seQuest;
    for (const enemy of battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead)) battle.kill(enemy, null);
  });
  await player.page.waitForSelector(".quest-window h2", { timeout: 30_000 });
  assert.equal((await player.page.locator(".quest-window h2").textContent()).trim(), "Victory!");
  await player.shot("victory");
  await player.wait(1500);
  const info = await (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(info.privateState.questsRank[HERO_ISLE], 1, "one star won");
}

/** The island's doors: open, which picture, and whether its tile can be walked. */
function doors(player) {
  return player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    const grid = battle.walkGrid();
    return quest.doors.map((d) => ({ at: [d.tx, d.ty], open: Boolean(d.open), facing: d.facing, walkable: grid[d.ty * 100 + d.tx] === 1 }));
  });
}
