// The scripted camps' new engine (CLIENT.md, "Scripted camps"), with the
// camps that have a boss and no keys. Camp 17: its window, the camp
// started on the server, two helpers by the town hall, the boss in its
// corner. A reload puts the corner back and the boss whole. The boss
// falls (by the test's hand, in a fight): the chest lights up and opens:
// the reward, three Axe Vikings beside it, the next camp. Camp 27 has no
// chest: the boss's fall ends it, and its prize goes to storage.

import assert from "node:assert/strict";

const KNIGHT = 514, VIKING = 606, AXE_VIKING = 607, BLACK_YETI = 667, CAVE = 492, BALROG = 682, INFERNAL_WARRIOR = 644;

export default async function scriptedBosses({ newPlayer }) {
  const player = await town(newPlayer, 17);
  await player.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 17, null, { timeout: 30_000 });
  assert.match(await player.page.locator(".notice h2").textContent(), /18 : /);
  await player.page.locator(".notice button").first().click();
  await player.wait(4000);
  let saved = await player.saved({ waitForBatch: false });
  assert.equal(saved.currentQuestVars.spawned, true, "the camp started, on the server");
  assert.equal(saved.items.filter((i) => i[0] === VIKING).length, 2, "two helpers");
  assert.ok(saved.items.some((i) => i[0] === BLACK_YETI && i[1] === 93 && i[2] === 11), "the boss in its corner");
  assert.ok(saved.items.some((i) => i[0] === CAVE));

  // A reload: the corner put back, the boss whole, and no second window.
  await player.reload();
  await player.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 17, null, { timeout: 30_000 });
  assert.equal(await player.page.locator(".notice").count(), 0);
  assert.equal(await player.page.evaluate(() => window.seHome.camps.scripted.bosses.length), 1);
  await player.wait(4000);
  saved = await player.saved({ waitForBatch: false });
  assert.equal(saved.items.filter((i) => i[0] === BLACK_YETI).length, 1, "one boss, not two");
  assert.equal(saved.items.filter((i) => i[0] === VIKING).length, 2, "the helpers stay two");

  await strikeAll(player);
  assert.ok(await player.page.evaluate(() => window.seHome.camps.scripted.chestOpen), "the cave lights up");
  saved = await player.saved();
  assert.deepEqual(saved.currentQuestVars.boss, [0], "the boss's fall saved");
  await player.page.evaluate(() => window.seHome.camps.tap(window.seHome.parts.town.items.find((p) => p.item.id === 492), null));
  await player.wait(500);
  saved = await player.saved();
  assert.equal(saved.items.filter((i) => i[0] === AXE_VIKING).length, 3, "three Axe Vikings");
  assert.ok(!saved.items.some((i) => i[0] === CAVE));
  assert.equal(saved.idCurrentTreasure, 18);
  assert.deepEqual(saved.currentQuestVars, {});
  await player.shot("boss-complete");
  // These are independent towns. Once its screen and save are checked,
  // close each one so software drawing in old tabs cannot starve the
  // next fight's clock. Keep the same 30-second deadline and assertions.
  await player.close();

  // Camp 27, the Balrog: no chest.
  const balrog = await town(newPlayer, 27);
  await balrog.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 27, null, { timeout: 30_000 });
  await balrog.page.locator(".notice button").first().click();
  assert.ok(await balrog.page.evaluate(() => window.seHome.parts.town.items.some((p) => p.item.id === 682)));
  await strikeAll(balrog);
  await balrog.wait(500);
  saved = await balrog.saved();
  assert.equal(saved.idCurrentTreasure, 28, "its fall ends the camp");
  assert.ok(!saved.items.some((i) => i[0] === BALROG));
  const stored = JSON.stringify(saved.store ?? {});
  assert.ok(stored.includes(String(INFERNAL_WARRIOR)), `the Infernal Warrior in storage: ${stored}`);
  await balrog.shot("reward-stored");
  await balrog.close();

  // Camp 21, the mummy: three gems, then the mummy, then the sarcophagus.
  const mummy = await town(newPlayer, 21);
  await mummy.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 21, null, { timeout: 30_000 });
  await mummy.page.locator(".notice button").first().click();
  assert.equal(await mummy.page.evaluate(() => window.seHome.camps.scripted.keys.length), 3);
  await strikeAll(mummy);
  await mummy.page.evaluate(() => window.seHome.camps.tap(window.seHome.camps.scripted.keys[0].key, null));
  // A reload between gems: the gem taken stays taken, the others come back guarded.
  await mummy.reload();
  await mummy.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 21, null, { timeout: 30_000 });
  const back = await mummy.page.evaluate(() => window.seHome.camps.scripted.keys.map((k) => k.guards));
  assert.equal(back.length, 2, "two gems left");
  assert.ok(back.every((g) => g >= 4), `guarded again: ${back}`);
  await strikeAll(mummy);
  await mummy.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  assert.deepEqual(await mummy.page.evaluate(() => window.seHome.camps.scripted.bosses.map((b) => b.item.id)), [669], "the mummy comes");
  await strikeAll(mummy);
  assert.ok(await mummy.page.evaluate(() => window.seHome.camps.scripted.chestOpen));
  await mummy.page.evaluate(() => window.seHome.camps.tap(window.seHome.parts.town.items.find((p) => p.item.id === 499), null));
  await mummy.wait(500);
  assert.equal((await mummy.saved()).idCurrentTreasure, 22);
  await mummy.shot("keys-complete");
  await mummy.close();

  // Camp 28, the demon portals: four portals and no chest; the last ends it, with two Celestial Soldiers beside it.
  const portals = await town(newPlayer, 28);
  await portals.page.waitForFunction(() => window.seHome?.camps.scripted.playing === 28, null, { timeout: 30_000 });
  await portals.page.locator(".notice button").first().click();
  await strikeAll(portals);
  await portals.page.evaluate(() => {
    for (const k of [...window.seHome.camps.scripted.keys]) window.seHome.camps.tap(k.key, null);
  });
  await portals.wait(500);
  saved = await portals.saved();
  assert.equal(saved.idCurrentTreasure, 29);
  assert.equal(saved.items.filter((i) => i[0] === 701).length, 2, "two Celestial Soldiers");
  assert.deepEqual(saved.currentQuestVars, {}, "nothing left over for the next camp");
  await portals.shot("portals-complete");
}

/** A new town at level 30 with a knight, the given camp due. */
async function town(newPlayer, camp) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  await player.send([{ cmd: "rt_level_up", args: [30] }, { cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 0, 1] },
    { cmd: "collect_treasure", args: [0, 0, camp, 0, 0, 0] }]);
  await player.reload();
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
    for (const f of fight.battle.fighters.filter((f) => f.side === 2 && f.isUnit)) fight.battle.kill(f, null);
  });
  try {
    await player.page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 30_000 });
  } catch (error) {
    console.log("fight at timeout", await player.page.evaluate(() => {
      const fight = window.seHome.fighting;
      return fight && { frame: fight.battle.frame, quiet: fight.quiet,
        active: fight.battle.fighters.filter((f) => !f.dead && f.side !== 3 && f.attacking && f.target && !f.target.dead)
          .map((f) => ({ id: f.item.id, target: f.target.item.id })) };
    }));
    throw error;
  }
}
