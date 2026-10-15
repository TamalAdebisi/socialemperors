// Neighbours (CLIENT.md, "Neighbours"): one player visits another, sees
// their own numbers in the top bar, and helps the other's farm (10 gold and
// 3 XP); the help goes on leaving. The other player's next visit home brings
// a donkey cart, let in, with a quarter of the farm's harvest. Arthur is
// always last among the neighbours, and his town opens.

import assert from "node:assert/strict";

const FARM = 10, FARM_AT = [56, 56];

export default async function neighbours({ newPlayer }) {
  const helped = await newPlayer();
  await helped.send([{ cmd: "buy", args: [FARM, ...FARM_AT, 0, 0, 0, 1] }]);
  const helper = await newPlayer();
  const { page } = helper;
  const gold = async (player) => Number((await player.page.locator('[data-n="gold"]').textContent()).replace(/,/g, ""));
  const info = async (player) => (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  const goldBefore = await gold(helper);

  // The neighbours: the other player, and Arthur last.
  await helper.menu("Neighbours");
  const names = await page.locator(".panel:not([hidden]) .row strong").allTextContents();
  assert.equal(names.at(-1), "Arthur", `Arthur comes last: ${names}`);
  assert.match(await page.locator(".panel:not([hidden]) .row .portrait").last().getAttribute("style"), /arthur/, "the game's king for Arthur");
  await helper.shot("neighbours");
  await page.getByRole("link", { name: `Visit ${helped.name}` }).click();
  await helper.loaded();
  assert.match(await page.locator(".hud-visiting").textContent(), new RegExp(`Visiting ${helped.name}`));
  assert.equal(await gold(helper), goldBefore, "the top bar shows the visitor's own gold");
  await helper.said(/Tap their farms, mills and mines to help/);

  // Help the farm: 10 gold; not twice.
  const farm = findFarm(helper);
  await helper.click(farm);
  await helper.said(/Helped! 4 more today/);
  assert.equal(await gold(helper), goldBefore + 10);
  await helper.click(farm);
  await helper.said(/already/);
  await helper.shot("helping");

  // Home: the help goes on the way out.
  await page.getByRole("link", { name: "Back home" }).click();
  await helper.loaded();
  const helperSaved = await info(helper);
  assert.equal(helperSaved.map.coins, goldBefore + 10, "the helper is paid");
  const theirs = await info(helped);
  assert.deepEqual(theirs.map.receivedAssists[`u${helper.settings.userId}`], [[...FARM_AT, FARM]], "the help waits for them");

  // The helped player's cart: let in, it brings the farm a quarter of its harvest (15 / 4 = 3 food).
  await helped.reload();
  assert.match(await helped.bar(), new RegExp(`^${helper.name} helped you`));
  await helped.shot("cart");
  const food = theirs.map.food;
  await helped.press("Let it in");
  // The cart walks to the farm, unloads, and the delivery goes with the next batch: wait for it to show.
  let delivered = await info(helped);
  for (let waited = 0; delivered.map.food === food && waited < 20_000; waited += 1000) {
    await helped.wait(1000);
    delivered = await info(helped);
  }
  await helped.shot("cart-delivered");
  assert.equal(delivered.map.food, food + 3, "the cart's share");
  assert.deepEqual(delivered.map.receivedAssists, {}, "the cart has come");

  // Arthur's town: the one for a new player's stage.
  await helper.menu("Neighbours");
  await page.getByRole("link", { name: "Visit Arthur" }).click();
  await helper.loaded();
  assert.match(await page.locator(".hud-visiting").textContent(), /Visiting Arthur/);
  assert.match(page.url(), /visit=100000030/);
  await helper.shot("arthur");
}

/** The farm on the screen: the middle of its 3 x 3 field (it's flat). */
function findFarm(player) {
  return player.screenOf(FARM_AT[0] - 1, FARM_AT[1] - 1, 27);
}
