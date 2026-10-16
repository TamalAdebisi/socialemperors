// Spells (CLIENT.md, "Spells"): at level 53, the Wizardry Academy's card
// opens its window; gold can't pay without the gold, cash learns Fire
// Havoc (with its first cast's mana) and buys 5 mana. On the Mysterious
// Isle the spell book shows the mana, Fire Havoc is aimed over the trolls
// and cast with a click: the trolls are hurt, and the server has the mana
// spent and the cast counted.

import assert from "node:assert/strict";

const KNIGHT = 514, ACADEMY = 416, MYSTERIOUS = 100000006, FIRE_HAVOC = 2, GOLEMS_WRATH = 6;

export default async function spells({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 6; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 44, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [53] }, { cmd: "buy", args: [ACADEMY, 56, 52, 0, 0, 0, 1] }, ...army]);
  await player.reload();
  const info = async () => {
    const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return response.json();
  };
  const before = await info();
  const cash = before.playerInfo.cash;
  // Level 53: 2 mana a level from 36.
  assert.equal(before.privateState.mana, 36);

  // The Academy's card: Spells.
  await player.select([56, 52], "Wizardry Academy");
  await player.page.getByRole("button", { name: "Spells" }).click();
  await player.wait(400);
  const window = player.page.locator(".panel.spells");
  assert.match(await window.textContent(), /Fire Havoc/);
  assert.match(await window.locator(".mana-pill").textContent(), /36/);
  await player.shot("academy");
  await player.page.getByRole("button", { name: "Learn Fire Havoc for 1,000 gold" }).click();
  assert.match(await window.locator(".spell-said").textContent(), /Not enough gold/);
  await player.page.getByRole("button", { name: "Learn Fire Havoc for 35 cash" }).click();
  assert.match(await window.locator(".spell-said").textContent(), /Fire Havoc learnt/);
  await player.page.getByRole("button", { name: "Buy 5 mana for 1 cash" }).click();
  assert.match(await window.locator(".mana-pill").textContent(), /46/, "36, 5 for learning, 5 bought");
  await player.page.getByRole("button", { name: "Learn Golem's Wrath for 45 cash" }).click();
  assert.match(await window.locator(".mana-pill").textContent(), /61/);
  await player.shot("learnt");
  await player.wait(1500);
  const learnt = await info();
  assert.equal(learnt.privateState.mana, 61);
  assert.deepEqual(learnt.privateState.magics, { [FIRE_HAVOC]: 0, [GOLEMS_WRATH]: 0 });
  assert.equal(learnt.playerInfo.cash, cash - 36 - 45);

  // The island: the book, its mana, the spell.
  await player.page.goto(`${player.base}/client.html?quest=${MYSTERIOUS}`);
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();
  assert.match(await player.page.locator(".spell-mana").textContent(), /61/);
  await player.page.getByRole("button", { name: "Spell book" }).click();
  await player.wait(800);
  await player.shot("book");
  await player.page.getByRole("button", { name: "Cast Fire Havoc (5 mana)" }).click();
  // Aim at the trolls: the tile below and right of them, so they're in the square.
  const aim = await player.page.evaluate(() => {
    const { battle, tileScreen } = window.seQuest;
    const trolls = battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead);
    const near = trolls.filter((t) => Math.abs(t.tx - trolls[0].tx) <= 2 && Math.abs(t.ty - trolls[0].ty) <= 2);
    const tile = { x: Math.max(...near.map((t) => t.tx)) + 1, y: Math.max(...near.map((t) => t.ty)) + 1 };
    return { tile, at: tileScreen(tile), lives: near.map((t) => t.life), keys: near.map((t) => t.key) };
  });
  // The trolls in the middle of the screen.
  await player.page.evaluate((tile) => window.seQuest.lookAt(tile), aim.tile);
  await player.wait(300);
  const point = await player.page.evaluate((tile) => window.seQuest.tileScreen(tile), aim.tile);
  await player.page.mouse.move(point.x, point.y);
  await player.wait(300);
  const lit = await player.page.evaluate(() => window.seQuest.view.lit.size);
  assert.ok(lit >= 1, "the marker lights the trolls under it");
  await player.shot("aiming");
  await player.page.mouse.click(point.x, point.y);
  await player.wait(1200);
  await player.shot("cast");
  await player.wait(2500);
  assert.match(await player.page.locator(".spell-mana").textContent(), /56/);
  const hurt = await player.page.evaluate((keys) => window.seQuest.battle.fighters
    .filter((f) => keys.includes(f.key)).map((f) => f.life < f.maxLife || f.dead), aim.keys);
  assert.ok(hurt.some(Boolean), "fireballs fell on the trolls");
  const cast = await info();
  assert.equal(cast.privateState.mana, 56);
  assert.deepEqual(cast.privateState.magics, { [FIRE_HAVOC]: 1, [GOLEMS_WRATH]: 0 });

  // A golem for the player, among the army.
  const landing = await player.page.evaluate(() => {
    const mine = window.seQuest.battle.fighters.find((f) => f.side === 1 && f.isUnit && !f.dead);
    return { x: mine.tx + 2, y: mine.ty + 2 };
  });
  await player.page.evaluate((tile) => window.seQuest.lookAt(tile), landing);
  await player.page.getByRole("button", { name: "Spell book" }).click();
  await player.page.getByRole("button", { name: "Cast Golem's Wrath (15 mana)" }).click();
  const there = await player.page.evaluate((tile) => window.seQuest.tileScreen(tile), landing);
  await player.page.mouse.move(there.x, there.y);
  await player.wait(200);
  await player.page.mouse.click(there.x, there.y);
  // The summoning takes 57 game frames. Software drawing may advance
  // fewer than that during a fixed three-second wall-clock sleep.
  await player.page.waitForFunction(() => window.seQuest.battle.fighters.some((f) => f.summoned),
    null, { timeout: 30_000 });
  await player.shot("golem");
  const golem = await player.page.evaluate(() => window.seQuest.battle.fighters
    .filter((f) => f.summoned).map((f) => ({ side: f.side, life: f.maxLife, name: f.item.name })));
  assert.deepEqual(golem, [{ side: 1, life: 4000, name: "Summoned Golem" }]);
  assert.match(await player.page.locator(".spell-mana").textContent(), /41/);
}
