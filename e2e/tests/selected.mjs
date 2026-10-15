// What's selected is marked as in the Flash client (CLIENT.md, "Selecting"):
// a unit stands on a golden ring that walks with it, a building's ground
// gets a golden outline of its size, and a life bar shows over either. The
// gold is counted on the screen; the screenshots show the rest.

import assert from "node:assert/strict";

// A villager and a house in the open in the middle of the screen, and a tile to walk to.
const VILLAGER = 500, SPOT = [52, 58], HOUSE = [1, 47, 55], WALK_TO = [55, 57];

export default async function selected({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
    { cmd: "buy", args: [...HOUSE, 0, 0, 1, 1] },
  ]);
  await player.reload();

  // How many golden pixels round a unit's feet (the middle of its tile), or along a building's front corner.
  const gold = async (box) => (await player.pixels(box)).filter(([r, g, b]) => r > 190 && g > 140 && b < 90 && r > g).length;
  const feet = ([tx, ty]) => {
    const p = player.screenOf(tx, ty, 27);
    return { x: Math.round(p.x - 45), y: Math.round(p.y - 25), width: 90, height: 50 };
  };
  const front = ([tx, ty]) => {
    const p = player.screenOf(tx, ty, 0);
    return { x: Math.round(p.x - 60), y: Math.round(p.y - 30), width: 120, height: 45 };
  };

  const unitBefore = await gold(feet(SPOT));
  const houseBefore = await gold(front(HOUSE.slice(1)));
  await player.select(SPOT, "Villager I");
  await player.wait(300);
  await player.shot("unit");
  assert.ok(await gold(feet(SPOT)) > unitBefore + 150, "a golden ring under the unit");

  // Walked off: the ring goes with it.
  await player.click(player.screenOf(...WALK_TO, 27));
  await player.wait(6000);
  await player.shot("walked");
  assert.ok(await gold(feet(WALK_TO)) > 150, "the ring is where it went");
  assert.ok(await gold(feet(SPOT)) < unitBefore + 50, "and not where it was");

  // A building: the outline of its ground, and the unit's ring gone.
  await player.select(HOUSE.slice(1), "House I");
  await player.wait(300);
  await player.shot("building");
  assert.ok(await gold(front(HOUSE.slice(1))) > houseBefore + 150, "a golden outline round the house's ground");
  assert.ok(await gold(feet(WALK_TO)) < 50, "the unit isn't marked now");

  // Nothing selected: nothing marked.
  await player.page.keyboard.press("Escape");
  await player.wait(300);
  assert.ok(await gold(front(HOUSE.slice(1))) < houseBefore + 50, "unmarked");
}
