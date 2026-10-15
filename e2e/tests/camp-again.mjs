// A camp attacked in two goes (PARITY.md, Beta 2): a troll the first fight
// moved, killed in the second, is gone from the server's save, which knows
// it by the tile it was saved on. (It used to come back after a reload.)

import assert from "node:assert/strict";

const KNIGHT = 514;

export default async function campAgain({ newPlayer }) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  await player.send([{ cmd: "buy", args: [KNIGHT, 50, 56, 0, 0, 1, 1, "u"] }]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  const troll = await player.page.evaluate(() => {
    const { parts, camps } = window.seHome;
    const t = parts.town.items.find((p) => p.item.isUnit && camps.sideOf(p) === "enemy");
    return { id: t.item.id, at: [t.tx, t.ty] };
  });
  // The first fight: the troll pushed two tiles, then everyone stands still until it's over.
  await player.page.evaluate((at) => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const t = parts.town.items.find((p) => p.item.isUnit && p.tx === at[0] && p.ty === at[1]);
    window.seHome.engage([knight], t);
    const fight = window.seHome.fighting;
    const f = fight.fighterOf(t);
    f.tx += 2;
    for (const o of fight.battle.fighters) {
      o.condition = "passive";
      o.target = null;
      o.attacking = false;
    }
  }, troll.at);
  await player.page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 60_000 });
  const moved = await player.page.evaluate((at) => window.seHome.parts.town.items.filter((p) => p.serverAt
    && p.serverAt.x === at[0] && p.serverAt.y === at[1] && p.tx !== at[0]).length, troll.at);
  assert.equal(moved, 1, "drawn where the fight left it, saved where it was");

  // The second fight: it falls.
  await player.page.evaluate((at) => {
    const { parts } = window.seHome;
    const knight = parts.town.items.find((p) => p.item.id === 514);
    const t = parts.town.items.find((p) => p.serverAt && p.serverAt.x === at[0] && p.serverAt.y === at[1] && p.tx !== at[0]);
    window.seHome.engage([knight], t);
    const fight = window.seHome.fighting;
    fight.battle.kill(fight.fighterOf(t), null);
  }, troll.at);
  await player.wait(500);
  const saved = await player.saved();
  assert.ok(!saved.items.some((i) => i[0] === troll.id && i[1] === troll.at[0] && i[2] === troll.at[1]), "gone from the save");
}
