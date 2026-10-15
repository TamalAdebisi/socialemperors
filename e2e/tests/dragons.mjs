// The dragons' islands (CLIENT.md, "Quests"). On the Dangerous Isle the
// golden dragons fall by the test's hand and the rocks closing the path
// go; the black dragon shrugs off a hit; the eggs, broken, wound it, and
// the eighth wins. On the Nest Isle the egg is broken and the Crimson
// Scale comes. Pictures for checking the big dragons are drawn.

import assert from "node:assert/strict";

const KNIGHT = 514, DANGEROUS = 100000033, BEFORE_DANGEROUS = 100000011, NEST = 100000028, BEFORE_NEST = 100000003;

export default async function dragons({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 10; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 44, 0, 0, 0, 1] });
  const won = (quest) => ({ cmd: "end_quest", args: [JSON.stringify({ map: 0, resources: { g: 0, x: 0 }, units: [], win: 1,
    duration: 60, voluntary_end: 0, quest_id: quest, difficulty: 1 })] });
  await player.send([{ cmd: "rt_level_up", args: [30] }, ...army, won(BEFORE_DANGEROUS), won(BEFORE_NEST)]);

  // The Dangerous Isle.
  await sail(player, DANGEROUS);
  const start = await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    const black = quest.boss.black;
    battle.hurt(black, 5000, null);
    return { dragons: quest.boss.bosses.map((b) => b.item.id), eggs: quest.boss.eggs.size, black: black.life, scale: black.scale };
  });
  assert.deepEqual(start, { dragons: [739, 739, 740], eggs: 8, black: 30000, scale: 2 });
  await look(player, "boss.black");
  await player.shot("black-dragon");
  await look(player, "boss.bosses[0]");
  await player.shot("golden-dragon");
  await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    for (const golden of quest.boss.bosses.filter((b) => b.item.id === 739)) battle.kill(golden, null);
  });
  await player.page.waitForFunction(() => !window.seQuest.battle.fighters.some((f) => f.item.id === 945 && f.ty === 43), null, { timeout: 30_000 });
  await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    for (const egg of [...quest.boss.eggs]) battle.kill(egg, null);
  });
  await won_(player);
  const info = await stars(player);
  assert.equal(info[DANGEROUS], 1);

  // The Nest Isle.
  await player.press("Back home");
  await player.page.waitForURL(/islands=1/);
  await player.loaded();
  await player.wait(1500);
  await sail(player, NEST);
  await player.page.evaluate(() => {
    const { battle } = window.seQuest;
    battle.kill(battle.fighters.find((f) => f.item.id === 437), null);
  });
  await player.page.waitForFunction(() => window.seQuest.quest.boss.bosses.length === 1, null, { timeout: 30_000 });
  assert.match(await player.page.locator(".quest-hud").textContent(), /Beat the boss!/);
  await look(player, "boss.bosses[0]");
  await player.shot("crimson-scale");
  await player.page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    battle.kill(quest.boss.bosses[0], null);
  });
  await won_(player);
  assert.equal((await stars(player))[NEST], 1);
}

async function sail(player, quest) {
  await player.page.goto(`${player.base}/client.html?quest=${quest}`);
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();
}

/** The camera on one of the quest's things (a path under seQuest.quest). */
async function look(player, path) {
  await player.page.evaluate((path) => {
    const thing = path.split(/[.[\]]/).filter(Boolean).reduce((at, key) => at[key], window.seQuest.quest);
    window.seQuest.lookAt({ x: thing.tx, y: thing.ty });
  }, path);
  // The big dragons' pictures take a while to come.
  await player.wait(5000);
}

async function won_(player) {
  await player.page.waitForSelector(".quest-window h2", { timeout: 30_000 });
  assert.equal((await player.page.locator(".quest-window h2").textContent()).trim(), "Victory!");
  await player.wait(1500);
}

async function stars(player) {
  const info = await (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  return info.privateState.questsRank;
}
