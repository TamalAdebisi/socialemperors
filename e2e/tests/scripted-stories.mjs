// The scripted camps with rules of their own (CLIENT.md, "Scripted
// camps"). The fireworks festival (14) fills up a step for each key taken.
// The Chinese dragon (23) can't be killed: below a tenth of its life it
// gets away (and counts as beaten); its village starts half burnt.
// Neptune's pen (24): each wave's fall opens its door. The Ent (25) can't
// be hurt until its wave falls and its door goes; its fall ends the camp.

import assert from "node:assert/strict";

const KNIGHT = 514;

export default async function scriptedStories({ newPlayer }) {
  // 14: the festival's steps.
  const festival = await town(newPlayer, 14);
  const chest = () => festival.page.evaluate(() => window.seHome.parts.town.items.find((p) => p.item.id === 487)?.steps);
  assert.equal(await chest(), 0, "the festival starts bare");
  await strikeAll(festival);
  await festival.page.evaluate(() => window.seHome.camps.tap(window.seHome.camps.scripted.keys[0].key, null));
  assert.equal(await chest(), 1, "a step for the first key");
  await festival.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  assert.equal(await chest(), 3);
  assert.ok(await festival.page.evaluate(() => window.seHome.camps.scripted.chestOpen));

  // Each scenario is complete before the next town opens. Flush its save
  // and release its renderer instead of keeping completed towns running.
  await festival.saved();
  await festival.close();

  // 23: the dragon gets away.
  const dragon = await town(newPlayer, 23);
  const burnt = await dragon.page.evaluate(() => window.seHome.parts.town.items.filter((p) => p.health !== undefined && !p.item.isUnit).length);
  assert.ok(burnt > 5, `the village half burnt (${burnt})`);
  await strikeAll(dragon);
  await dragon.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  assert.deepEqual(await dragon.page.evaluate(() => window.seHome.camps.scripted.bosses.map((b) => b.item.id)), [671]);
  await dragon.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const boss = window.seHome.camps.scripted.bosses[0];
    window.seHome.engage([knight], boss);
    const fight = window.seHome.fighting;
    const it = fight.fighterOf(boss);
    fight.battle.hurt(it, 999999, fight.fighterOf(knight));
  });
  assert.ok(await dragon.page.evaluate(() => {
    const it = window.seHome.fighting.fighterOf(window.seHome.camps.scripted.bosses[0]);
    return it.life >= 1 && it.fleeing;
  }), "it can't die: it gets away");
  await dragon.page.waitForFunction(() => window.seHome.camps.scripted.chestOpen, null, { timeout: 30_000 });

  await dragon.saved();
  await dragon.close();

  // 24: Neptune's doors.
  const neptune = await town(newPlayer, 24);
  const doors = () => neptune.page.evaluate(() => window.seHome.parts.town.items.filter((p) => p.item.id === 37).length);
  assert.equal(await doors(), 2);
  await neptune.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const crab = parts.town.items.find((p) => p.item.id === 679);
    window.seHome.engage([knight], crab);
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => f.item.id === 679)) fight.battle.kill(f, null);
  });
  await neptune.page.waitForFunction(() => window.seHome.parts.town.items.filter((p) => p.item.id === 37).length === 1, null, { timeout: 10_000 });
  await neptune.page.evaluate(() => {
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => f.item.id === 680)) fight.battle.kill(f, null);
  });
  await neptune.page.waitForFunction(() => window.seHome.parts.town.items.filter((p) => p.item.id === 37).length === 0, null, { timeout: 10_000 });
  await neptune.wait(3000);
  const saved = await neptune.saved();
  assert.equal(saved.items.filter((i) => i[0] === 37).length, 0, "both doors gone from the save");

  await neptune.close();

  // 25: the Ent.
  const ent = await town(newPlayer, 25);
  await ent.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const boss = window.seHome.camps.scripted.bosses[0];
    window.seHome.engage([knight], boss);
    const fight = window.seHome.fighting;
    fight.battle.hurt(fight.fighterOf(boss), 5000, null);
  });
  assert.equal(await ent.page.evaluate(() => window.seHome.fighting.fighterOf(window.seHome.camps.scripted.bosses[0]).life), 8000, "no harm while its door stands");
  await ent.page.evaluate(() => {
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => [675, 676, 677].includes(f.item.id))) fight.battle.kill(f, null);
  });
  await ent.page.waitForFunction(() => !window.seHome.parts.town.items.some((p) => p.item.id === 37), null, { timeout: 10_000 });
  await ent.page.evaluate(() => {
    const fight = window.seHome.fighting;
    const it = fight.fighterOf(window.seHome.camps.scripted.bosses[0]);
    fight.battle.hurt(it, 5000, null);
    if (it.life >= 8000) throw new Error("still unhurt after the door went");
    fight.battle.kill(it, null);
  });
  await ent.page.waitForFunction(() => window.seHome.camps.scripted.playing === null, null, { timeout: 10_000 });
  await ent.wait(1000);
  const after = await ent.saved();
  assert.equal(after.idCurrentTreasure, 26, "the Ent's fall ends the camp");
  assert.equal(after.items.filter((i) => i[0] === 628).length, 3, "the helper and two Elf Druids");
}

/** A new town at level 30 with a knight, the given camp due and its window closed. */
async function town(newPlayer, camp) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  await player.send([{ cmd: "rt_level_up", args: [30] }, { cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 0, 1] },
    { cmd: "collect_treasure", args: [0, 0, camp, 0, 0, 0] }]);
  await player.reload();
  await player.page.waitForFunction((camp) => window.seHome?.camps.scripted.playing === camp, camp, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  return player;
}

/** The knight sent at an enemy: a fight, where the test strikes every enemy down; then it's over. */
async function strikeAll(player) {
  await player.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const enemy = parts.town.items.find((p) => p.item.isUnit && window.seHome.camps.sideOf(p) === "enemy");
    window.seHome.engage([knight], enemy);
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.flee)) fight.battle.kill(f, null);
  });
  await player.page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 30_000 });
}
