// Collection pieces (CLIENT.md, "Collection pieces"), as the Flash client
// drops them: a villager fells a tree, and with the roll for a piece at its
// luckiest (the test sets it; a real harvest gives one 4 times in 100) the
// rarest kind drops: the Ravager Troll's first piece. Its picture pops up
// from the tree, a message names it, and the server's save has it.

import assert from "node:assert/strict";

const VILLAGER = 500, TREE = 19, WORKER = [50, 54], TREE_AT = [54, 55];

export default async function collections({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "buy", args: [VILLAGER, ...WORKER, 0, 0, 1, 1] },
    { cmd: "buy", args: [TREE, ...TREE_AT, 0, 0, 1, 1] },
  ]);
  await player.reload();
  await page.evaluate(() => {
    window.seHome.parts.editor.lootRoll = () => 0;
  });

  const tree = await player.select(TREE_AT, "Tree");
  await player.press("Close");
  await player.select(WORKER, "Villager I");
  await player.click(tree.point);
  // The tree comes down (the walk and the work: some seconds); the piece pops up with it.
  await page.waitForFunction(([x, y]) => !window.seHome.parts.town.items.some((p) => p.item.id === 19 && p.tx === x && p.ty === y),
    TREE_AT, { timeout: 60_000 });
  // The message stays 2.5 seconds: looked for while the picture is taken.
  await Promise.all([player.said(/You found a collection piece: .+, of .+\./), (async () => {
    await player.wait(300);
    await player.shot("found");
  })()]);

  await player.saved();  // the commands sent
  const saved = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(saved.privateState.collections?.[19]?.[1], 1, "the Ravager Troll's first piece, on the server");
}
