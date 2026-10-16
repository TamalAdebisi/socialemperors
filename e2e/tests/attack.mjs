// Attacking a player (CLIENT.md, "Attacking players"): a level 10 town with
// an army finds Attack beside the other player in Neighbours, picks a start
// corner round the edge of their island, and the battle opens in their town
// with their defence plan. The army is sent at the town hall until it falls,
// and the results say the attack is won. The server has the attack, its
// report, the gold, and the attack in the defender's history; Back home
// goes home.

import assert from "node:assert/strict";

const KNIGHT = 514, TOWN_HALL = 135;

export default async function attack({ newPlayer }) {
  const victim = await newPlayer();
  // Their defence plan: all stay at home.
  await victim.send([{ cmd: "set_strategy", args: [8] }]);
  const player = await newPlayer();
  const army = [];
  for (let i = 0; i < 20; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 10), 44 + Math.floor(i / 10), 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.reload();
  const before = await player.saved({ waitForBatch: false });

  // Neighbours: Attack beside the other player, none beside Arthur.
  await player.menu("Neighbours");
  const panel = player.page.locator(".panel:not([hidden])");
  assert.equal(await panel.getByRole("link", { name: "Attack Arthur" }).count(), 0, "Arthur isn't attacked");
  const go = panel.getByRole("link", { name: `Attack ${victim.name}` });
  assert.match(await go.getAttribute("href"), new RegExp(`attack=${victim.settings.userId}`));
  await go.click();

  // The start corner: the 16 border blocks to pick from, the top left picked.
  await player.page.waitForSelector(".attack-grid", { timeout: 60_000 });
  assert.equal(await player.page.locator(".attack-cell:not(:disabled)").count(), 16);
  assert.equal(await player.page.locator(".attack-cell.picked").getAttribute("aria-label"), "Start at block 0, 0");
  await player.page.getByRole("button", { name: "Start at block 2, 0" }).click();
  await player.shot("corner");
  await player.press("Start the battle");
  await player.page.waitForFunction(() => window.seAttack, null, { timeout: 60_000 });
  await player.loaded();
  await player.shot("landed");
  const start = await player.page.evaluate(() => {
    const { battle, plan, targets } = window.seAttack;
    const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit);
    return { plan: plan.plan, targets: targets.size, army: mine.length, x: mine[0].tx, y: mine[0].ty,
      hall: battle.fighters.some((f) => f.side === 2 && f.item.subcategory === 135) };
  });
  assert.equal(start.plan, 8, "their defence plan");
  assert.ok(start.hall && start.targets >= 1, `their town hall is a target: ${JSON.stringify(start)}`);
  assert.ok(start.army >= 20, `the army came: ${start.army}`);
  assert.ok(Math.abs(start.x - 50) < 8 && start.y < 20, `on the top edge, in the middle: ${start.x}, ${start.y}`);
  assert.match(await player.page.locator(".quest-hud").textContent(), /targets? left/);

  // Faster, every unit at the town hall, until it falls.
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  let tries = 0;
  while (await player.page.locator(".quest-window h2").count() === 0) {
    assert.ok(++tries < 80, "the town hall still stands");
    const idle = await player.page.evaluate(() =>
      !window.seAttack.battle.fighters.some((f) => f.side === 1 && f.isUnit && !f.dead && (f.target || f.next)));
    if (idle) {
      const hall = await player.page.evaluate((sub) => {
        const { battle, screenOf } = window.seAttack;
        const found = battle.fighters.find((f) => f.side === 2 && !f.dead && f.item.subcategory === sub);
        return found ? { tx: found.tx, ty: found.ty, screen: screenOf(found) } : null;
      }, TOWN_HALL);
      if (hall) {
        await player.page.evaluate((tile) => window.seAttack.lookAt(tile), { x: hall.tx, y: hall.ty });
        await player.wait(300);
        await player.press("Select all");
        await player.click(await player.page.evaluate((sub) => {
          const { battle, screenOf } = window.seAttack;
          return screenOf(battle.fighters.find((f) => f.side === 2 && !f.dead && f.item.subcategory === sub));
        }, TOWN_HALL));
      }
    }
    await player.wait(1500);
  }
  assert.match(await player.page.locator(".quest-window h2").textContent(), /You won the attack/);
  await player.shot("won");

  // The server has it: the attack and its report, the gold, and the defender's history.
  await player.wait(1500);
  const info = await (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  const sent = info.privateState.attacksSent;
  assert.equal(sent.length, 1, "one attack made");
  assert.equal(sent[0].victim_id, String(victim.settings.userId));
  assert.equal(sent[0].description.win, 1);
  const gold = sent[0].description.resources.g;
  assert.ok(gold >= 25, `the town hall paid: ${gold}`);
  assert.equal(info.map.coins, before.coins + gold, "the gold came home");
  assert.equal(info.privateState.attacksWon, 1);
  const theirs = await victim.page.request.post(`${victim.base}${victim.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: victim.settings.userId, user_key: victim.settings.userKey } });
  const received = (await theirs.json()).privateState.attacksReceived;
  assert.equal(received.length, 1, "the defender has the attack");
  assert.equal(received[0].attacker_id, String(player.settings.userId));
  assert.equal(received[0].viewPending, 1, "to be shown when they come home");

  // Home again.
  await player.press("Back home");
  await player.page.waitForURL(/client\.html$/);
  await player.loaded();
  await player.shot("home");
}
