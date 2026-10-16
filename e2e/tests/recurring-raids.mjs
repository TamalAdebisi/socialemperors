// Let the real scheduler run (accelerating its clock, without hurry/bring):
// tutorial protection, low-level attacks, four waves and recovery, saved rewards.
import assert from "node:assert/strict";

export default async function recurringRaids({ newPlayer }) {
  const player = await newPlayer({ raids: true });
  const { page } = player;
  await page.waitForFunction(() => window.seHome);
  // A rescued town has cleared the two tutorial trolls as well as its camp.
  const oldEnemies = await page.evaluate(() => {
    const home = window.seHome;
    return home.parts.town.items.filter((p) => home.camps.sideOf(p) === "enemy")
      .map((p) => ({ cmd: "kill", args: [p.tx, p.ty, p.item.id, 0, p.item.isUnit ? "u" : "b"] }));
  });
  await player.send(oldEnemies);
  await player.reload();
  await page.waitForFunction(() => window.seHome);
  const before = await player.saved();
  await page.evaluate(() => {
    const home = window.seHome;
    home.parts.quiet = () => true;
    for (let i = 0; i < 1300; i++) home.tick(250);
  });
  assert.equal(await page.evaluate(() => Boolean(window.seHome.fighting)), false, "no raids during lessons");
  await page.evaluate(() => { window.seHome.parts.quiet = () => false; });
  let killed = 0;
  for (let wave = 0; wave < 4; wave++) {
    await page.evaluate(() => {
      for (let i = 0; i < 1800 && !window.seHome.fighting; i++) window.seHome.tick(250);
    });
    const size = await page.evaluate(() => window.seHome.fighting?.raids[0].alive.length ?? 0);
    assert.equal(size, 2, `low-level wave ${wave + 1} arrives without a player order`);
    await page.waitForFunction(() => window.seHome.fighting.raids[0].alive.every((f) => f.target), null, { timeout: 15000 }).catch(async (error) => {
      const state = await page.evaluate(() => {
        const fight = window.seHome.fighting;
        return { frame: fight.battle.frame, units: fight.raids[0].alive.map((f) => ({ id: f.item.id, x: f.tx, y: f.ty,
          target: f.target?.item.name, path: f.path.length, moving: fight.battle.isMoving(f), offset: f.offset })) };
      });
      throw new Error(`${error.message}: ${JSON.stringify(state)}`);
    });
    if (wave === 0) await player.shot("incoming");
    killed += size;
    await page.evaluate(() => {
      const fight = window.seHome.fighting;
      for (const unit of [...fight.raids[0].alive]) fight.battle.kill(unit, null);
      for (let i = 0; i < 100 && window.seHome.fighting; i++) window.seHome.tick(250);
    });
    assert.equal(await page.evaluate(() => Boolean(window.seHome.fighting)), false);
    const recovery = await page.evaluate(() => (window.seHome.waiting[0].startsAt - window.seHome.clock) / 30);
    assert.ok(recovery >= 415 && recovery <= 420, `seven minutes to recover (${recovery})`);
  }
  await page.waitForFunction(() => /Next raid 6:|Next raid 7:/.test(document.querySelector(".home-threats")?.textContent ?? ""));
  await player.shot("recovery");
  const after = await player.saved();
  assert.equal(after.coins, before.coins + killed * 5, "all four waves' rewards persist on the server");
}
