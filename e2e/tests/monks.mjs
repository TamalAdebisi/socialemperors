// Monks at home (CLIENT.md, "Defending the town"): a monk of the player's,
// sent at the first troll camp, turns a troll to the player's side, as on
// the islands; the turned troll shows lighter. Nothing is sent for it, as
// in the Flash client.

import assert from "node:assert/strict";

const MONK = 569;

export default async function monks({ newPlayer }) {
  const player = await newPlayer({ camp: true });
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.locator(".notice button").first().click();
  // The monk beside the camp's nearest troll, so it's in reach at once.
  const near = await player.page.evaluate(() => {
    const troll = window.seHome.parts.town.items.find((p) => p.item.isUnit && window.seHome.camps.sideOf(p) === "enemy");
    return [troll.tx, troll.ty];
  });
  await player.send([{ cmd: "rt_level_up", args: [30] }, { cmd: "buy", args: [MONK, near[0] - 3, near[1], 0, 0, 1, 1, "u"] }]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  const notice = player.page.locator(".notice button");
  if (await notice.count()) await notice.first().click();
  await player.page.evaluate(() => {
    const { parts, camps } = window.seHome;
    const monk = parts.town.items.find((p) => p.item.id === 569);
    const enemy = parts.town.items.find((p) => p.item.isUnit && camps.sideOf(p) === "enemy");
    window.seHome.engage([monk], enemy);
  });
  await player.page.waitForFunction(() => window.seHome.fighting?.battle.fighters.some((f) => f.converted && f.side === 1),
    null, { timeout: 30_000 });
  await player.shot("turned");
}
