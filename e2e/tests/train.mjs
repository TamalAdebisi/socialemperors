// Training and population (CLIENT.md, "Training and population"): a new
// town has room for 11 people (the town hall and two houses) and 6 (two
// knights and two archers) live there. The town hall trains villagers, one
// at a time, each in 3 seconds, for 50 food, until there's no room; the
// save has them, with the food paid.

import assert from "node:assert/strict";

const VILLAGER = 500, HALL = [52, 52];

export default async function train({ newPlayer }) {
  const player = await newPlayer();
  const people = () => player.page.locator(".hud-people [data-people]").textContent();
  assert.equal(await people(), "6/11", "the top bar counts the people");

  const before = await player.saved({ waitForBatch: false });
  const hall = await player.select(HALL, "Town Hall");
  assert.equal(await player.button("Train Villager I").isVisible(), true);
  assert.match(await player.button("Train Villager I").textContent(), /50 food/);

  for (let n = 1; n <= 5; n++) {
    await player.press("Train Villager I");
    if (n === 1) {
      assert.match(await player.bar(), /Training Villager I/, "the card says it's training");
      await player.shot("training");
    }
    await player.wait(3300);
    assert.equal(await people(), `${6 + n}/11`);
  }
  await player.shot("trained");
  // Full: the next one says why.
  await player.press("Train Villager I");
  assert.match(await player.status(), /No room for more people/);

  const after = await player.saved();
  const villagers = (map) => map.items.filter((i) => i[0] === VILLAGER).length;
  assert.equal(villagers(after), villagers(before) + 5, "five new villagers in the save");
  assert.equal(after.food, before.food - 5 * 50, "50 food each");
  const near = after.items.filter((i) => i[0] === VILLAGER).every((i) => Math.abs(i[1] - HALL[0]) <= 3 && Math.abs(i[2] - HALL[1]) <= 3);
  assert.ok(near, "each stands by the town hall");
  void hall;

  // The Army window counts them.
  await player.page.keyboard.press("Escape");
  await player.menu("Army");
  assert.match(await player.page.locator(".army-people").textContent(), /People: 11 of 11/);
}
