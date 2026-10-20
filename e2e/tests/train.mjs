// Training and population (CLIENT.md, "Training and population"): a new
// town has room for 11 people (the town hall and two houses) and 6 live
// there (two knights, two archers, two small trolls). Villagers take no
// room (the owner's rule, DECISIONS.md, 20 October 2026: the server's config
// gives them none), so the villager the game gives a town with none
// (lib.mjs keeps her far off) isn't counted. Five spearmen fill the town;
// the town hall still trains villagers, one at a time, each in 3 seconds,
// for 50 food, and the count stays full. The save has them, with the food
// paid.

import assert from "node:assert/strict";

const VILLAGER = 500, SPEARMAN = 509, HALL = [52, 52];

export default async function train({ newPlayer }) {
  const player = await newPlayer();
  const people = () => player.page.locator(".hud-people [data-people]").textContent();
  assert.equal(await people(), "6/11", "the top bar counts the people, not the villager");

  // Five spearmen, as the Flash client places bought units: the town is full.
  await player.send(Array.from({ length: 5 }, (_, i) => ({ cmd: "buy", args: [SPEARMAN, 40 + i, 60, 0, 0, 1, 1, "u"] })));
  await player.reload();
  assert.equal(await people(), "11/11");

  const before = await player.saved({ waitForBatch: false });
  await player.select(HALL, "Town Hall");
  assert.equal(await player.button("Train Villager I").isVisible(), true);
  // The price under the TRAIN box, as the game's: "COST: 50" and food's picture.
  assert.match(await player.page.locator(".card-train-cost").textContent(), /COST: 50/);
  assert.equal(await player.page.locator(".card-train-cost img").getAttribute("alt"), "food");

  for (let n = 1; n <= 4; n++) {
    await player.press("Train Villager I");
    if (n === 1) {
      assert.match(await player.bar(), /Training Villager I/, "the card says it's training");
      await player.shot("training");
    }
    await player.wait(3300);
    assert.equal(await people(), "11/11", "a villager takes no room");
  }
  await player.shot("trained");

  const after = await player.saved();
  const villagers = (map) => map.items.filter((i) => i[0] === VILLAGER).length;
  assert.equal(villagers(after), villagers(before) + 4, "four new villagers in the save, in a full town");
  assert.equal(after.food, before.food - 4 * 50, "50 food each");
  const near = after.items.filter((i) => i[0] === VILLAGER).every((i) => Math.abs(i[1] - HALL[0]) <= 3 && Math.abs(i[2] - HALL[1]) <= 3);
  assert.ok(near, "each stands by the town hall");

  // The Army window counts the soldiers only.
  await player.page.keyboard.press("Escape");
  await player.menu("Army");
  assert.match(await player.page.locator(".army-people").textContent(), /People: 11 of 11/);
}
