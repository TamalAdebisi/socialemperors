// Troll camps (CLIENT.md, "Troll camps"): a new town gets its first camp
// at once (the princess's village, for a human town): the game's window
// tells of it, the camp stands on the border with its soldiers, and trolls
// stand about the border. The chest (here a prison) stays shut while any
// enemy unit is left; sending a knight at the camp makes the town a
// battlefield (the enemies are then struck down by the test's hand). Then
// the prison opens: the prize by level, the princess freed, and the next
// camp in 10 minutes, all kept by the server.

import assert from "node:assert/strict";

const KNIGHT = 514, PRINCESS = 533, PRISON = 83;

export default async function camp({ newPlayer }) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.wait(1000);
  // The camp's window, in the game's words.
  const title = (await player.page.locator(".notice h2").textContent()).trim();
  assert.match(title, / : /, `the camp's title: ${title}`);
  await player.shot("camp-window");
  await player.page.getByRole("button", { name: "OK" }).click();
  const state = () => player.page.evaluate(() => {
    const { camps, parts } = window.seHome;
    const chest = parts.town.items.find((p) => p.item.subcategory === 811);
    return { chest: chest && [chest.item.id, chest.tx, chest.ty], enemies: camps.enemiesLeft() };
  });
  const before = await state();
  assert.equal(before.chest[0], PRISON);
  assert.ok(before.enemies >= 8, `the camp's soldiers and the border's trolls (${before.enemies})`);
  await player.wait(4000);
  const saved = await player.saved({ waitForBatch: false });
  assert.ok(saved.items.some((i) => i[0] === PRISON), "the server keeps the camp");

  // Shut while enemies are left.
  await player.page.evaluate(() => {
    const { camps, parts } = window.seHome;
    camps.tap(parts.town.items.find((p) => p.item.subcategory === 811), null);
  });
  assert.match(await player.said(/enemies left/), /\d+ enemies left/);

  // A knight sent at a camp soldier: the town is a battlefield. The test strikes every enemy down.
  await player.send([{ cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 0, 1] }, { cmd: "rt_level_up", args: [12] }]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.evaluate(() => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const enemy = parts.town.items.find((p) => p.item.isUnit && window.seHome.camps.sideOf(p) === "enemy");
    window.seHome.engage([knight], enemy);
    const fight = window.seHome.fighting;
    for (const f of fight.battle.fighters.filter((f) => f.side === 2 && f.isUnit)) fight.battle.kill(f, null);
  });
  await player.page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 30_000 });
  assert.equal((await state()).enemies, 0);

  // The prison opens: the prize, the princess, the next camp.
  const coins = (await player.saved()).coins;
  await player.page.evaluate(() => {
    const { camps, parts } = window.seHome;
    camps.tap(parts.town.items.find((p) => p.item.subcategory === 811), null);
  });
  await player.wait(500);
  await player.shot("opened");
  const after = await player.saved();
  assert.ok(!after.items.some((i) => i[0] === PRISON), "the prison is gone");
  assert.equal(after.coins, coins + 450, "level 12: 450 gold");
  assert.equal(after.idCurrentTreasure, 1, "the next camp");
  assert.ok(after.items.some((i) => i[0] === PRINCESS), "the princess is freed");
  // The next mission is visible immediately and arrives without reopening town.
  await player.page.waitForFunction(() => /Next camp (9:|10:)/.test(document.querySelector(".home-threats")?.textContent ?? ""));
  await player.page.evaluate(() => {
    const home = window.seHome;
    const now = home.parts.clock();
    home.parts.clock = () => now + 601;
    home.camps.parts.clock = home.parts.clock;
    home.camps.watch();
  });
  await player.page.waitForFunction(() => window.seHome.parts.town.items.some((p) => p.item.subcategory === 811));
  const next = await player.saved();
  assert.equal(next.idCurrentTreasure, 1);
  assert.ok(next.items.some((i) => i[0] === 86), "the next camp's prison is saved");
}
