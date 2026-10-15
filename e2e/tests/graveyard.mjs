// The graveyards (CLIENT.md, "The graveyard"). A town at level 20 with a
// Graveyard, a Heroes' Graveyard and an Altar of Heroes; two Heavy Knights,
// a Spearman and a Ranger have fallen. The Graveyard's Open lists the
// knights and the spearman, not the hero; the spearman comes back for food
// and gold beside it, and the server has him and the count less one. The
// potion buttons wait for potions, and 49 cash doesn't buy one. The
// Heroes' Graveyard brings the Ranger back for gold; the Altar sells
// Prince Arthur for cash.

import assert from "node:assert/strict";

const KNIGHT = 514, SPEARMAN = 509, RANGER = 535, ARTHUR = 534, GRAVEYARD = 486, HEROES_GRAVE = 239, ALTAR = 150;
const GRAVE_AT = [56, 52], HEROES_AT = [48, 58], ALTAR_AT = [62, 55];

export default async function graveyard({ newPlayer }) {
  const player = await newPlayer();
  const fallen = [[KNIGHT, 44, 44, 1], [KNIGHT, 45, 44, 1], [SPEARMAN, 46, 44, 1], [RANGER, 47, 44, 0]];
  await player.send([
    { cmd: "rt_level_up", args: [20] },
    // Free (the sixth argument), so the town keeps its gold.
    { cmd: "buy", args: [GRAVEYARD, ...GRAVE_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [HEROES_GRAVE, ...HEROES_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [ALTAR, ...ALTAR_AT, 0, 0, 1, 1, "b"] },
    ...fallen.map(([id, x, y]) => ({ cmd: "buy", args: [id, x, y, 0, 0, 1, 1, "u"] })),
    ...fallen.map(([id, x, y, flag]) => ({ cmd: "sell", args: [x, y, id, 0, 1, "KILL", flag] })),
    { cmd: "exchange_cash_new", args: [0] },  // 5 cash for 2,500 gold: enough for the Ranger
  ]);
  await player.reload();
  const info = async () => {
    const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return response.json();
  };
  const before = await info();
  // A level 20 test town: 250 gold and 54 cash, then the exchange.
  assert.equal(before.map.coins, 2750);
  assert.equal(before.playerInfo.cash, 49);
  assert.deepEqual(before.privateState.deadHeroes, { [KNIGHT]: 2, [SPEARMAN]: 1, [RANGER]: 1 }, "the fallen, on the server");

  // The Graveyard: the knights and the spearman, not the hero.
  await player.select(GRAVE_AT, "Graveyard");
  await player.press("Get units");
  const window = player.page.locator(".panel.graveyard:not([hidden])");
  const text = await window.textContent();
  assert.match(text, /Heavy Knight.*×2/);
  assert.match(text, /Spearman.*×1/);
  assert.doesNotMatch(text, /Ranger/);
  assert.ok(await player.button("Resurrect Spearman for 1 potions").isDisabled(), "no potions yet");
  await player.shot("graveyard");

  await player.press("Resurrect Spearman for 30 food and 15 gold");
  assert.match(await window.locator(".grave-said").textContent(), /Spearman is back/);
  assert.doesNotMatch(await window.locator(".rows").textContent(), /Spearman/, "none left to bring back");
  const back = await player.page.evaluate((at) => {
    const spearman = window.seHome.parts.town.items.find((p) => p.item.id === 509);
    return spearman && Math.max(Math.abs(spearman.tx - at[0]), Math.abs(spearman.ty - at[1]));
  }, GRAVE_AT);
  assert.ok(back !== undefined && back <= 4, `beside the graveyard (${back} tiles)`);

  // Potions: 100 cash for one, and the town has 49.
  await player.button(/^Buy 1 potion/).click();
  await player.wait(300);
  assert.match(await window.locator(".grave-said").textContent(), /enough cash to buy potions/);
  await player.wait(1500);
  const after = await info();
  assert.deepEqual(after.privateState.deadHeroes, { [KNIGHT]: 2, [RANGER]: 1 });
  assert.equal(after.map.food, before.map.food - 30);
  assert.equal(after.map.coins, before.map.coins - 15);
  assert.ok(after.map.items.some((i) => i[0] === SPEARMAN));

  // The Heroes' Graveyard: the Ranger back for 1,500 gold.
  await player.page.keyboard.press("Escape");
  await player.select(HEROES_AT, "Heroes Grave");
  await player.press("Get units");
  const heroes = player.page.locator(".panel.graveyard:not([hidden])");
  assert.match(await heroes.textContent(), /Ranger.*×1/);
  assert.ok(await player.button("Resurrect Thor for 4500 gold").isDisabled(), "nobody to bring back");
  await player.shot("heroes-grave");
  await player.press("Resurrect Ranger for 1500 gold");
  assert.equal(await heroes.count(), 0, "the window closes, as in the original");
  await player.wait(1500);
  const revived = await info();
  assert.equal(revived.map.coins, after.map.coins - 1500);
  assert.deepEqual(revived.privateState.deadHeroes, { [KNIGHT]: 2 });
  assert.ok(revived.map.items.some((i) => i[0] === RANGER));
  assert.equal(revived.map.xp, after.map.xp + 25, "the Ranger's experience again");

  // The Altar of Heroes: Prince Arthur for 5 cash; the High Elf from level 27.
  await player.select(ALTAR_AT, "Altar of Heroes");
  await player.press("Get units");
  const altar = player.page.locator(".panel.graveyard:not([hidden])");
  assert.match(await altar.textContent(), /High Elf/);
  assert.ok(await player.button("Get High Elf for 9 cash").isDisabled(), "level 27");
  await player.shot("altar");
  await player.press("Get Prince Arthur for 5 cash");
  await player.wait(1500);
  const bought = await info();
  assert.equal(bought.playerInfo.cash, 44);
  assert.ok(bought.map.items.some((i) => i[0] === ARTHUR));
}
