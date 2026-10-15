// Raids (CLIENT.md, "Defending the town"): a town at level 12 is raided
// by a band of bandits (brought on at once instead of after 7 minutes).
// The town becomes a battlefield: building waits, the soldiers fight, the
// bandits are killed or leave. Each raider killed pays 5 gold, and the
// server keeps it; then the town is the player's again, with its units
// where the fight left them and its burnt buildings to repair.

import assert from "node:assert/strict";

const KNIGHT = 514, VILLAGER = 500, HOUSE = [44, 50];

export default async function raids({ newPlayer }) {
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 8; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 52, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [12] }, { cmd: "buy", args: [VILLAGER, 48, 56, 0, 0, 0, 1] }, ...army]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  const plans = await player.page.evaluate(() => window.seHome.waiting.map((p) => ({ kind: p.kind, at: p.startsAt, n: p.units.length })));
  assert.deepEqual(plans, [{ kind: "bandits", at: 7 * 60 * 30, n: 3 }], "level 12: one band of 3, at 7 minutes");
  const before = await player.saved({ waitForBatch: false });

  // The band comes now.
  await player.page.evaluate(() => window.seHome.hurry());
  await player.wait(1500);
  assert.ok(await player.page.evaluate(() => Boolean(window.seHome.fighting)));
  assert.match(await player.bar(), /under attack/, "building waits");
  const room = async () => Number((await player.page.locator(".hud").textContent()).match(/\d+\/(\d+)/)[1]);
  const roomBefore = await room();
  // The villager must live to repair later: bandits go for units too.
  await player.page.evaluate(() => {
    const villager = window.seHome.fighting.battle.fighters.find((f) => f.item.id === 500);
    villager.life = villager.maxLife = 100000;
  });
  // A house burnt out (as if the bandits got there first).
  await player.page.evaluate(([x, y]) => {
    const fight = window.seHome.fighting;
    const house = fight.battle.fighters.find((f) => !f.isUnit && f.tx === x && f.ty === y);
    fight.battle.hurt(house, 100000, null);
  }, HOUSE);
  await player.shot("raid");

  // A hit by a raider out of sight (the camera off at the map's corner): the
  // battle's tune, and the "under attack" alert, whose button looks there.
  const heard = await player.page.evaluate(() => {
    const { fighting: fight, parts } = window.seHome;
    const building = fight.battle.fighters.find((f) => f.side === 1 && !f.isUnit && !f.dead && f.life > 200);
    window.seCentre = { ...parts.camera.centre };
    parts.camera.lookAt({ x: -20000, y: 20000 });
    fight.battle.hurt(building, 80, fight.raids[0].fighters[0]);
    return { track: parts.sound.currentTrack };
  });
  assert.equal(heard.track, "BATALLA.mp3");
  await player.page.waitForSelector(".attack-alert", { timeout: 5000 });
  await player.page.locator(".attack-alert button").click();
  await player.wait(500);
  await player.shot("after-alert");
  // The camera back where the test's taps expect it.
  await player.page.evaluate(() => window.seHome.parts.camera.lookAt(window.seCentre));

  // The knights at the bandits, until the raid is over.
  let killed = 0;
  for (let i = 0; i < 150; i++) {
    const state = await player.page.evaluate(() => {
      const fight = window.seHome.fighting;
      if (!fight) return { over: true };
      const knights = fight.battle.fighters.filter((f) => f.item.id === 514 && !f.dead && !f.target);
      const bandit = fight.raids[0].alive[0];
      if (bandit && knights.length) fight.battle.attackWith(knights, bandit);
      return { over: false, killed: fight.raids[0].fighters.filter((f) => f.dead).length };
    });
    if (state.over) break;
    killed = state.killed;
    if (i === 15) await player.shot("fighting");
    await player.wait(1000);
  }
  assert.equal(await player.page.evaluate(() => Boolean(window.seHome.fighting)), false, "the raid is over");
  assert.notEqual(await player.page.evaluate(() => window.seHome.parts.sound.currentTrack), "BATALLA.mp3", "the town's tune again");
  assert.equal(await player.bar(), "", "the town is the player's again");
  killed = await player.page.evaluate(() => window.seHome.kills);
  assert.ok(killed > 0, "the knights killed some");
  await player.shot("after");
  // The house burns until it's repaired, and gives no room for people meanwhile.
  const health = () => player.page.evaluate(([x, y]) => window.seHome.parts.town.items
    .find((p) => !p.item.isUnit && p.tx === x && p.ty === y).health ?? null, HOUSE);
  assert.equal(await health(), 0);
  assert.equal(await room(), roomBefore - 3, "a House I's room is gone");
  // A villager repairs it: 25 life every 2 seconds.
  const villager = await player.page.evaluate(() => {
    const unit = window.seHome.parts.town.items.find((p) => p.item.id === 500);
    return [unit.tx, unit.ty];
  });
  await player.select(villager, "Villager");
  // Tap the house itself (trees stand in front of it): the first point above its tile that is the house.
  let onHouse = null;
  for (let up = 20; up <= 200 && !onHouse; up += 10) {
    const point = player.screenOf(HOUSE[0], HOUSE[1], up);
    const hit = await player.page.evaluate(([point, [x, y]]) => {
      const placed = window.seHome.parts.view.itemAt(point);
      return Boolean(placed && placed.tx === x && placed.ty === y);
    }, [point, HOUSE]);
    if (hit) onHouse = point;
  }
  assert.ok(onHouse, "the house can be tapped");
  await player.click(onHouse);
  await player.wait(9000);
  assert.ok((await health()) >= 25, `repairing (${await health()})`);
  assert.equal(await room(), roomBefore - 3, "no room until it's repaired in full");
  await player.shot("repairing");

  // The server: 5 gold for each bandit killed, and no knight more than before.
  const after = await player.saved();
  assert.equal(after.coins, before.coins + 5 * killed);
  const knights = (map) => map.items.filter((i) => i[0] === KNIGHT).length;
  assert.ok(knights(after) <= knights(before));
}
