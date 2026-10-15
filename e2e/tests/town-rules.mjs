// Town rules from the map of the original (PARITY.md, "Found by the map of
// the original"), checked in the save: a social building waiting for staff
// gets a free helper each time the town opens (two at most); and lifting a
// building to move it lets its workers out, even when the move is cancelled.

import assert from "node:assert/strict";

const SUMMIT = [234, 45, 58], FARM = [10, 55, 56], VILLAGER = 500, SPOT = [56, 57];

export default async function townRules({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [...SUMMIT, 0, 0, 1, 1] },
    { cmd: "finish_si", args: [SUMMIT[1], SUMMIT[2], 0, SUMMIT[0]] },  // its staff list starts, empty
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
    { cmd: "push_unit", args: [...SPOT, VILLAGER, FARM[1], FARM[2], 0] },
  ]);
  const staff = async () => {
    const summit = (await player.saved()).items.find(([id, x, y]) => id === SUMMIT[0] && x === SUMMIT[1] && y === SUMMIT[2]);
    return summit?.[7]?.si?.length;
  };
  // The player's cash, from the server (it isn't in the town's own save).
  const cash = async () => {
    const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return (await response.json()).playerInfo.cash;
  };
  const before = await cash();

  // Each opening: one free helper, up to two.
  await player.reload();
  assert.equal(await staff(), 1, "a free helper as the town opens");
  await player.reload();
  assert.equal(await staff(), 2, "a second at the next (it has 9 places)");
  await player.reload();
  assert.equal(await staff(), 2, "no more after two");
  assert.ok(Number.isFinite(before));
  assert.equal(await cash(), before, "they're free");

  // The farm lifted, then put back where it was: its villager is out.
  await player.select(FARM.slice(1), "Farm Land");
  await player.press("Move");
  await player.page.keyboard.press("Escape");
  const saved = await player.saved();
  const farm = saved.items.find(([id, x, y]) => id === FARM[0] && x === FARM[1] && y === FARM[2]);
  assert.deepEqual(farm?.[6] ?? [], [], "nobody inside the farm now");
  assert.ok(saved.items.some(([id]) => id === VILLAGER), "the villager is on the map");
}
