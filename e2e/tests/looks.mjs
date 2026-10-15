// Farms show what's going on (CLIENT.md, "Villagers at work"): an empty
// field stands still; a villager sent in plays the villager at work, so the
// picture changes; let out (and walked off), it's an empty field, still,
// again. (Played straight through, as before, it cycled through a man, a
// woman and ripe crops whoever was there.)

import assert from "node:assert/strict";

// A field of 2 x 2 tiles ending at (55, 56), in the open in the middle of the screen.
const FARM = [10, 55, 56], VILLAGER = 500, SPOT = [56, 58], AWAY = [46, 57];

export default async function looks({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
  ]);
  await player.reload();
  const middle = player.screenOf(54.5, 55.5, 25);
  const field = { x: middle.x - 80, y: middle.y - 50, width: 160, height: 90 };
  // Whether the field's picture changes over a second, looked at five times.
  const changes = async () => {
    const shots = [];
    for (let i = 0; i < 5; i++) {
      shots.push(await player.page.screenshot({ clip: field }));
      await player.wait(200);
    }
    return shots.some((shot) => !shot.equals(shots[0]));
  };
  assert.ok(!(await changes()), "nobody in it: an empty field, still");
  await player.shot("empty");

  // The villager in: at work (the harvest takes 32 seconds, so it isn't ripe yet).
  const farm = await player.select(FARM.slice(1), "Farm Land");
  await player.press("Close");
  await player.select(SPOT, "Villager I");
  await player.click(farm.point);
  await player.wait(3000);
  assert.ok(await changes(), "a villager at work in the farm");
  await player.shot("at-work");

  // Let out, and sent off, out of the picture.
  await player.select(FARM.slice(1), "Farm Land");
  await player.press("Let out");
  await player.press("Close");
  const out = (await player.saved()).items.find((i) => i[0] === VILLAGER);
  await player.select([out[1], out[2]], "Villager I");
  await player.tapTile(AWAY);
  await player.wait(5000);
  await player.page.keyboard.press("Escape");
  assert.ok(!(await changes()), "let out: an empty field, still");
  await player.shot("let-out");
}
