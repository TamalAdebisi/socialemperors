// The scripted camps (CLIENT.md, "Scripted camps"). A human town at camp
// 7, the burning mill: its window, three wells in the corners, each
// guarded. The guards fall (by the test's hand, in a fight the player
// starts), the wells light up and are taken one by one (each pays its
// experience and goes from the save), then the mill opens: the level's
// reward and the next camp. Then camp 13, the skeleton statue: the
// statues taken, a wave of five skeletons comes; once it's beaten the
// chest opens.

import assert from "node:assert/strict";

const KNIGHT = 514, WELL = 210, MILL = 211, STATUE = 258, SKELETON_CHEST = 259;

export default async function scripted({ newPlayer }) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  // As if the first six camps were done: camp 7 is next, and due.
  await player.send([{ cmd: "rt_level_up", args: [12] }, { cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 0, 1] },
    { cmd: "collect_treasure", args: [0, 0, 7, 0, 0, 0] }]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.waitForSelector(".notice h2", { timeout: 10_000 });
  assert.match(await player.page.locator(".notice h2").textContent(), /8 : /, "the camp's window, quest 8");
  await player.shot("mill-window");
  await player.page.locator(".notice button").first().click();
  const keys = () => player.page.evaluate(() => window.seHome.camps.scripted.keys.map((k) => ({ id: k.key.item.id, lit: k.lit, guards: k.guards })));
  let now = await keys();
  assert.equal(now.length, 3);
  // Three soldiers each, and any border troll that stands near (as in the original).
  assert.ok(now.every((k) => k.id === 210 && !k.lit && k.guards >= 3), JSON.stringify(now));
  await player.wait(4000);
  let saved = await player.saved({ waitForBatch: false });
  assert.equal(saved.items.filter((i) => i[0] === WELL).length, 3, "the server keeps the wells");
  assert.ok(saved.items.some((i) => i[0] === MILL));

  // A tap on a guarded well says so.
  await player.page.evaluate(() => window.seHome.camps.tap(window.seHome.camps.scripted.keys[0].key, null));
  assert.match(await player.said(/guard/), /\d+ enemies guard it/);

  // A fight: every enemy struck down. The wells light up.
  await strikeAll(player);
  now = await keys();
  assert.ok(now.every((k) => k.lit), JSON.stringify(now));
  const xp = await player.page.evaluate(() => window.seHome.parts.town.xp);
  await player.page.evaluate(() => window.seHome.camps.tap(window.seHome.camps.scripted.keys[0].key, null));
  assert.equal(await player.page.evaluate(() => window.seHome.parts.town.xp), xp + 20, "a well pays 20 experience");
  assert.equal((await keys()).length, 2);
  await player.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  assert.ok(await player.page.evaluate(() => window.seHome.camps.scripted.chestOpen), "the mill lights up");
  await player.shot("mill-lit");
  const coins = (await player.saved()).coins;
  await player.page.evaluate(() => {
    const mill = window.seHome.parts.town.items.find((p) => p.item.id === 211);
    window.seHome.camps.tap(mill, null);
  });
  await player.wait(500);
  saved = await player.saved();
  assert.ok(!saved.items.some((i) => i[0] === WELL || i[0] === MILL), "wells and mill gone");
  assert.equal(saved.coins, coins + 450, "level 12: 450 gold");
  assert.equal(saved.idCurrentTreasure, 8, "the next camp");
  await player.page.getByRole("button", { name: "OK" }).first().click();

  // This town is finished. Release its renderer before opening the next
  // scenario so software drawing does not starve the fight's quiet clock.
  await player.close();

  // Camp 13, the skeleton statue, in another town.
  const second = await newPlayer({ camp: true });
  await second.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await second.page.locator(".notice button").first().click();
  await second.send([{ cmd: "rt_level_up", args: [12] }, { cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 0, 1] },
    { cmd: "collect_treasure", args: [0, 0, 13, 0, 0, 0] }]);
  await skeletons(second);
}

async function skeletons(player) {
  const keys = () => player.page.evaluate(() => window.seHome.camps.scripted.keys.map((k) => ({ id: k.key.item.id, lit: k.lit, guards: k.guards })));
  let saved;
  await player.reload();
  await player.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 13, null, { timeout: 30_000 });
  await player.shot("statue-window");
  await player.page.locator(".notice button").first().click();
  assert.equal((await keys()).filter((k) => k.id === STATUE).length, 3);
  await strikeAll(player);
  await player.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  // The wave: five skeletons by the chest; the chest waits for them.
  const wave = await player.page.evaluate(() => window.seHome.parts.town.items.filter((p) => (p.item.id === 558 || p.item.id === 559) && p.tx === 92).length);
  assert.equal(wave, 5);
  assert.equal(await player.page.evaluate(() => window.seHome.camps.scripted.chestOpen), false);
  await strikeAll(player);
  assert.ok(await player.page.evaluate(() => window.seHome.camps.scripted.chestOpen), "the chest lights up");
  await player.page.evaluate(() => {
    const chest = window.seHome.parts.town.items.find((p) => p.item.id === 259);
    window.seHome.camps.tap(chest, null);
  });
  await player.wait(500);
  saved = await player.saved();
  assert.ok(!saved.items.some((i) => i[0] === SKELETON_CHEST));
  assert.equal(saved.idCurrentTreasure, 14);
}

/** The knight sent at an enemy: a fight, where the test strikes every enemy down; then it's over. */
async function strikeAll(player) {
  await player.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const enemy = parts.town.items.find((p) => p.item.isUnit && window.seHome.camps.sideOf(p) === "enemy");
    window.seHome.engage([knight], enemy);
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => f.side === 2 && f.isUnit)) fight.battle.kill(f, null);
  });
  await player.page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 30_000 });
}
