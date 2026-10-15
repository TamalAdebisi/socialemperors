// Special moves (CLIENT.md, "Special moves"): an army with the Warrior
// Princess and the Elemental Fire God sails to the Mysterious Isle. The
// princess's whirlwind comes by itself as she fights; the god, selected
// alone, shows its buttons (the game's pictures) and its LIMIT bar; a
// button pressed near the trolls works, and then every button waits.

import assert from "node:assert/strict";

const KNIGHT = 514, PRINCESS = 533, FIRE_GOD = 2075, MYSTERIOUS = 100000006;

export default async function specials({ newPlayer }) {
  const player = await newPlayer();
  const army = [{ cmd: "buy", args: [PRINCESS, 44, 46, 0, 0, 0, 1] }, { cmd: "buy", args: [FIRE_GOD, 46, 46, 0, 0, 0, 1] }];
  for (let i = 0; i < 4; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 44, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.page.goto(`${player.base}/client.html?quest=${MYSTERIOUS}`);
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();

  // The god alone, by the test's hand: its buttons show.
  const god = await player.page.evaluate((id) => {
    const { battle, view } = window.seQuest;
    const god = battle.fighters.find((f) => f.item.id === id);
    window.seQuest.select([god]);
    return god.key;
  }, FIRE_GOD);
  await player.wait(400);
  const buttons = player.page.locator(".special-buttons .special-button");
  assert.ok(await buttons.count() >= 2, "its moves and its LIMIT");
  assert.equal(await player.page.locator(".special-button.limit").count(), 1);
  await player.shot("buttons");

  // To the trolls, everyone; the god presses its first move once there.
  await player.page.evaluate(() => {
    const { battle } = window.seQuest;
    const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
    const troll = battle.fighters.find((f) => f.side === 2 && f.isUnit && !f.dead);
    battle.attackWith(mine, troll);
  });
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  let pressed = false;
  let whirled = false;
  for (let i = 0; i < 60 && !(pressed && whirled); i++) {
    await player.wait(1000);
    const state = await player.page.evaluate((key) => {
      const { battle } = window.seQuest;
      const god = battle.fighters.find((f) => f.key === key);
      const princess = battle.fighters.find((f) => f.item.id === 533);
      return { princess: Boolean(princess?.special), godNear: battle.fighters.some((f) => f.side === 2 && f.isUnit && !f.dead
        && Math.max(Math.abs(f.tx - god.tx), Math.abs(f.ty - god.ty)) <= 6), over: window.seQuest.quest.state !== "fighting" };
    }, god);
    whirled ||= state.princess;
    if (!pressed && state.godNear) {
      await player.page.evaluate((key) => {
        const god = window.seQuest.battle.fighters.find((f) => f.key === key);
        window.seQuest.lookAt({ x: god.tx, y: god.ty });
      }, god);
      const first = buttons.first();
      await first.click();
      await player.wait(300);
      pressed = true;
      await player.wait(700);
      await player.shot("pressed");
      assert.match(await buttons.first().getAttribute("aria-label"), /ready in \d+ s/, "then the buttons wait");
    }
    if (state.over) break;
  }
  assert.ok(pressed, "the god got near the trolls");
  assert.ok(whirled, "the princess's whirlwind came by itself");
}
